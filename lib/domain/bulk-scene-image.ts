import type { ImageGenerationStatus, SceneImageBatchStatus } from "@/db/schema";

export type SceneImageBatchDisplayStatus =
  "pending" | "processing" | "completed" | "completedWithErrors" | "cancelled";

export interface SceneImageBatchCounts {
  total: number;
  pending: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}

export const EMPTY_SCENE_IMAGE_BATCH_COUNTS: SceneImageBatchCounts = {
  total: 0,
  pending: 0,
  queued: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
};

const ACTIVE_STATUSES: ReadonlySet<ImageGenerationStatus> = new Set([
  "pending",
  "queued",
  "running",
]);

export function isActiveImageGenerationStatus(
  status: ImageGenerationStatus,
): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function addImageGenerationStatusToCounts(
  counts: SceneImageBatchCounts,
  status: ImageGenerationStatus,
): SceneImageBatchCounts {
  return {
    ...counts,
    total: counts.total + 1,
    [status]: counts[status] + 1,
  };
}

/**
 * Derives the batch display status from its stored status and the live child
 * generation counts. Completion is always derived from children so mutable
 * per-status counters never drift from the authoritative generation rows.
 */
export function deriveSceneImageBatchDisplayStatus(input: {
  storedStatus: SceneImageBatchStatus;
  counts: SceneImageBatchCounts;
}): SceneImageBatchDisplayStatus {
  const { storedStatus, counts } = input;
  const active = counts.pending + counts.queued + counts.running;

  if (storedStatus === "pending" && counts.total === 0) return "pending";
  // Any still-active child means the batch is still resolving, even if the
  // batch was cancelled (running provider calls cannot be interrupted).
  if (active > 0) return "processing";
  if (storedStatus === "cancelled") return "cancelled";
  if (counts.failed > 0 || counts.cancelled > 0) return "completedWithErrors";
  if (counts.total === 0) return "pending";
  return "completed";
}

export function isSceneImageBatchComplete(
  counts: SceneImageBatchCounts,
): boolean {
  return (
    counts.total > 0 && counts.pending + counts.queued + counts.running === 0
  );
}
