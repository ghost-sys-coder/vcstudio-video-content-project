import "server-only";

import { tasks } from "@trigger.dev/sdk";
import { attachRecordedAudioInspectionRun } from "@/db/commands/media-inspection-commands";
import { listPendingMediaInspections } from "@/db/repositories/media-inspection.repository";
import type { mediaInspectionTask } from "@/trigger/media-inspection";
import { reconcileMediaInspection } from "@/lib/media/reconcile-media-inspection";

export async function dispatchPendingMediaInspections(limit = 25) {
  const pending = await listPendingMediaInspections(limit);
  let dispatched = 0;
  for (const video of pending.videos) {
    try {
      await reconcileMediaInspection(video);
    } catch {
      console.warn(
        "Pending video verification status could not be reconciled.",
      );
    }
  }
  for (const recording of pending.recordings) {
    const handle = await tasks.trigger<typeof mediaInspectionTask>(
      "media-inspection",
      { kind: "recorded_audio", ...recording },
      {
        idempotencyKey: `media-inspection:recorded-audio:${recording.generationId}`,
      },
    );
    await attachRecordedAudioInspectionRun({
      ...recording,
      triggerRunId: handle.id,
    });
    dispatched += 1;
  }
  return {
    pending: pending.videos.length + pending.recordings.length,
    dispatched,
  };
}
