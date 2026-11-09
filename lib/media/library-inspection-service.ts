import "server-only";
import { tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import {
  attachMediaAssetInspectionRun,
  claimMediaAssetInspectionRetry,
} from "@/db/commands/media-inspection-commands";
import { reconcileMediaInspection } from "./reconcile-media-inspection";
import { mediaAvailability } from "./media-availability";
import { toMediaAssetView, type MediaAssetView } from "./media-asset-view";
import { mediaAssetThumbnailKey } from "./video-thumbnail";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import type { mediaInspectionTask } from "@/trigger/media-inspection";

export type LibraryInspectionResult =
  { ok: true; assets: MediaAssetView[] } | { ok: false; error: string };

async function context() {
  const result = await getAuthenticatedWorkspaceContext();
  if (!result || !can(result.activeMembership.role, "manageMediaLibrary"))
    throw new Error("MEDIA_ACCESS_DENIED");
  return result;
}

async function view(
  asset: NonNullable<Awaited<ReturnType<typeof findMediaAsset>>>,
) {
  const ready = mediaAvailability(asset).ready;
  const thumbnailKey = mediaAssetThumbnailKey(asset);
  return toMediaAssetView(
    asset,
    ready ? await createMediaAssetDownloadUrl(asset.objectKey) : "",
    thumbnailKey ? await createMediaAssetDownloadUrl(thumbnailKey) : undefined,
  );
}

export async function checkLibraryInspections(
  input: unknown,
): Promise<LibraryInspectionResult> {
  try {
    const ids = z.array(z.uuid()).min(1).max(12).parse(input);
    const authorized = await context();
    const assets: MediaAssetView[] = [];
    // Explicit bounded checks only; no background polling on the server.
    for (const id of new Set(ids)) {
      const asset = await reconcileMediaInspection({
        workspaceId: authorized.activeMembership.workspaceId,
        mediaAssetId: id,
      });
      if (!asset || asset.deletedAt || asset.kind !== "video")
        throw new Error("MEDIA_UNAVAILABLE");
      assets.push(await view(asset));
    }
    return { ok: true, assets };
  } catch {
    console.warn("Library video inspection status could not be checked.");
    return {
      ok: false,
      error:
        "Video status could not be checked. Your uploaded file is preserved; try Check status again.",
    };
  }
}

export async function retryLibraryInspection(
  input: unknown,
): Promise<LibraryInspectionResult> {
  try {
    const id = z.uuid().parse(input);
    const authorized = await context();
    const workspaceId = authorized.activeMembership.workspaceId;
    const asset = await reconcileMediaInspection({
      workspaceId,
      mediaAssetId: id,
    });
    if (!asset || asset.deletedAt || asset.kind !== "video")
      throw new Error("MEDIA_UNAVAILABLE");
    if (asset.status !== "failed" || asset.inspectionStatus !== "failed")
      return { ok: true, assets: [await view(asset)] };
    await enforceRateLimit({ workspaceId, operation: "media_inspection" });
    const claimed = await claimMediaAssetInspectionRetry({
      workspaceId,
      mediaAssetId: id,
      previousRunId: asset.inspectionTriggerRunId,
    });
    if (!claimed) throw new Error("RETRY_CONFLICT");
    const handle = await tasks.trigger<typeof mediaInspectionTask>(
      "media-inspection",
      { kind: "media_asset", workspaceId, mediaAssetId: id },
      {
        idempotencyKey: `media-inspection:retry:${id}:${asset.inspectionTriggerRunId ?? asset.updatedAt.getTime()}`,
      },
    );
    await attachMediaAssetInspectionRun({
      workspaceId,
      mediaAssetId: id,
      triggerRunId: handle.id,
    });
    await recordAuditEvent({
      workspaceId,
      actorUserId: authorized.user.id,
      action: "storage_reconciled",
      targetType: "media_asset",
      targetId: id,
      metadata: {
        operation: "retry_video_verification",
        reusedOriginal: true,
      },
    });
    const current = await findMediaAsset({ workspaceId, mediaAssetId: id });
    return { ok: true, assets: [await view(current ?? claimed)] };
  } catch {
    console.warn("Library video inspection retry could not be completed.");
    return {
      ok: false,
      error:
        "Verification could not be restarted. The request may still be processing; check its status before retrying. Your original file is preserved.",
    };
  }
}
