import "server-only";

import { tasks } from "@trigger.dev/sdk";
import {
  attachMediaAssetInspectionRun,
  attachRecordedAudioInspectionRun,
} from "@/db/commands/media-inspection-commands";
import { listPendingMediaInspections } from "@/db/repositories/media-inspection.repository";
import type { mediaInspectionTask } from "@/trigger/media-inspection";

export async function dispatchPendingMediaInspections(limit = 25) {
  const pending = await listPendingMediaInspections(limit);
  let dispatched = 0;
  for (const video of pending.videos) {
    const handle = await tasks.trigger<typeof mediaInspectionTask>(
      "media-inspection",
      { kind: "media_asset", ...video },
      { idempotencyKey: `media-inspection:asset:${video.mediaAssetId}` },
    );
    await attachMediaAssetInspectionRun({ ...video, triggerRunId: handle.id });
    dispatched += 1;
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
