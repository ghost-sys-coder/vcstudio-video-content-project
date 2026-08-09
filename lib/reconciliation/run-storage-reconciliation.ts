import "server-only";

import {
  finalizeStorageReconciliation,
  getAbandonedUploadCheckpoint,
  getAssetHealthCheckpoint,
  isStorageObjectReferenced,
  listStorageReconciliationCandidates,
  listSuccessfulAssetHealthCandidates,
  saveAssetHealthCheckpoint,
  saveAbandonedUploadCheckpoint,
  workspaceExists,
} from "@/db/repositories/storage-reconciliation.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { deleteReconciliationObject } from "@/lib/storage/reconciliation-storage";
import { reconciliationObjectExists } from "@/lib/storage/reconciliation-storage";
import { listWorkspaceObjectsForReconciliation } from "@/lib/storage/abandoned-upload-storage";

const WORKSPACE_KEY =
  /^workspaces\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\//i;

export async function runStorageReconciliation(input: {
  batchSize: number;
  dryRun: boolean;
  abandonedUploadHours: number;
}) {
  const candidates = await listStorageReconciliationCandidates({
    limit: input.batchSize,
  });
  let deletedCount = 0;
  let missingCount = 0;
  let errorCount = 0;
  let abandonedUploadCount = 0;
  let missingObjectCount = 0;
  for (const candidate of candidates) {
    const issue = candidate.objectKey
      ? ("leaked" as const)
      : ("missing" as const);
    if (input.dryRun) {
      if (issue === "leaked") deletedCount += 1;
      else missingCount += 1;
      continue;
    }
    try {
      if (candidate.objectKey)
        await deleteReconciliationObject(candidate.objectKey);
      const repaired = await finalizeStorageReconciliation({
        ...candidate,
        issue,
      });
      if (!repaired) continue;
      if (issue === "leaked") deletedCount += 1;
      else missingCount += 1;
      await recordAuditEvent({
        workspaceId: candidate.workspaceId,
        projectId: candidate.projectId,
        action: "storage_reconciled",
        targetType: candidate.family,
        targetId: candidate.id,
        metadata: { issue, objectDeleted: issue === "leaked" },
      });
    } catch (error) {
      errorCount += 1;
      console.error("Storage reconciliation candidate failed.", {
        family: candidate.family,
        id: candidate.id,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const checkpoint = await getAbandonedUploadCheckpoint();
  const listed = await listWorkspaceObjectsForReconciliation({
    startAfter: checkpoint,
    limit: input.batchSize,
  });
  const cutoff = Date.now() - input.abandonedUploadHours * 60 * 60 * 1000;
  for (const object of listed.objects) {
    if (object.lastModified.getTime() > cutoff) continue;
    try {
      if (await isStorageObjectReferenced(object.objectKey)) continue;
      abandonedUploadCount += 1;
      if (input.dryRun) continue;
      await deleteReconciliationObject(object.objectKey);
      const workspaceId = WORKSPACE_KEY.exec(object.objectKey)?.[1];
      if (workspaceId && (await workspaceExists(workspaceId))) {
        await recordAuditEvent({
          workspaceId,
          action: "storage_reconciled",
          targetType: "abandoned_upload",
          metadata: { issue: "abandoned_upload", objectDeleted: true },
        });
      } else {
        console.warn(
          "Deleted abandoned object for a workspace that no longer exists.",
          { objectKey: object.objectKey },
        );
      }
    } catch (error) {
      errorCount += 1;
      console.error("Abandoned upload reconciliation failed.", {
        objectKey: object.objectKey,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }
  await saveAbandonedUploadCheckpoint(listed.nextStartAfter);

  const healthCheckpoint = await getAssetHealthCheckpoint();
  const health = await listSuccessfulAssetHealthCandidates({
    startAfter: healthCheckpoint,
    limit: input.batchSize,
  });
  for (const candidate of health.candidates) {
    try {
      if (await reconciliationObjectExists(candidate.objectKey!)) continue;
      missingObjectCount += 1;
      if (input.dryRun) continue;
      const repaired = await finalizeStorageReconciliation({
        ...candidate,
        issue: "missing_object",
      });
      if (repaired)
        await recordAuditEvent({
          workspaceId: candidate.workspaceId,
          projectId: candidate.projectId,
          action: "storage_reconciled",
          targetType: candidate.family,
          targetId: candidate.id,
          metadata: { issue: "missing_object", objectDeleted: false },
        });
    } catch (error) {
      errorCount += 1;
      console.error("Stored asset health check failed.", {
        family: candidate.family,
        id: candidate.id,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }
  await saveAssetHealthCheckpoint(health.nextStartAfter);
  return {
    scannedCount: candidates.length,
    deletedCount,
    missingCount,
    errorCount,
    abandonedUploadCount,
    missingObjectCount,
    dryRun: input.dryRun,
    truncated: candidates.length === input.batchSize,
  };
}
