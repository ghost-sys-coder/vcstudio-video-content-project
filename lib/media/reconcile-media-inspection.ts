import "server-only";
import { runs } from "@trigger.dev/sdk";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { failMediaAssetInspection } from "@/db/commands/media-inspection-commands";

const TERMINAL = new Set([
  "COMPLETED",
  "FAILED",
  "CRASHED",
  "CANCELED",
  "TIMED_OUT",
  "EXPIRED",
  "SYSTEM_FAILURE",
]);

/** Reconcile only an owned pending asset. Never expose worker payloads or provider errors. */
export async function reconcileMediaInspection(input: {
  workspaceId: string;
  mediaAssetId: string;
}) {
  const asset = await findMediaAsset(input);
  if (
    !asset ||
    asset.deletedAt ||
    asset.kind !== "video" ||
    asset.status !== "pending" ||
    !["pending", "running"].includes(asset.inspectionStatus ?? "")
  )
    return asset;
  if (!asset.inspectionTriggerRunId) {
    if (Date.now() - asset.updatedAt.getTime() < 10 * 60_000) return asset;
    await failMediaAssetInspection({
      ...input,
      expectedRunId: null,
      message:
        "Verification could not start. Retry verification using the saved original.",
    });
  } else {
    const run = await runs.retrieve(asset.inspectionTriggerRunId);
    if (!TERMINAL.has(run.status)) return asset;
    // The guarded write cannot change a now-ready asset or a different retry's run.
    await failMediaAssetInspection({
      ...input,
      expectedRunId: asset.inspectionTriggerRunId,
      message: run.error?.message?.includes("OOM")
        ? "Verification ran out of memory. Retry verification using the saved original."
        : "Verification stopped before completion. Retry verification using the saved original.",
    });
  }
  return findMediaAsset(input);
}
