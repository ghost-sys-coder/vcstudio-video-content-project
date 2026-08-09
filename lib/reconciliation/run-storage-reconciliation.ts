import "server-only";

import {
  finalizeStorageReconciliation,
  listStorageReconciliationCandidates,
} from "@/db/repositories/storage-reconciliation.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { deleteReconciliationObject } from "@/lib/storage/reconciliation-storage";

export async function runStorageReconciliation(input: {
  batchSize: number;
  dryRun: boolean;
}) {
  const candidates = await listStorageReconciliationCandidates({
    limit: input.batchSize,
  });
  let deletedCount = 0;
  let missingCount = 0;
  let errorCount = 0;
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
  return {
    scannedCount: candidates.length,
    deletedCount,
    missingCount,
    errorCount,
    dryRun: input.dryRun,
    truncated: candidates.length === input.batchSize,
  };
}
