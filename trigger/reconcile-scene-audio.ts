import { schedules } from "@trigger.dev/sdk";
import { failSceneAudioGeneration } from "@/db/commands/scene-audio-commands";
import { listExpiredActiveSceneAudioGenerations } from "@/db/repositories/scene-audio.repository";

const RECONCILIATION_BATCH_SIZE = 100;

export const reconcileExpiredSceneAudioTask = schedules.task({
  id: "reconcile-expired-scene-audio",
  cron: "*/5 * * * *",
  queue: { name: "media-processing", concurrencyLimit: 1 },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async () => {
    const generations = await listExpiredActiveSceneAudioGenerations({
      now: new Date(),
      limit: RECONCILIATION_BATCH_SIZE,
    });
    let reconciledCount = 0;
    let errorCount = 0;

    for (const generation of generations) {
      try {
        await failSceneAudioGeneration({
          workspaceId: generation.workspaceId,
          projectId: generation.projectId,
          generationId: generation.generationId,
          category: "reservation_expired",
          safeErrorMessage:
            "The narration reservation expired before it completed. Generate a new version to try again.",
          providerBilled: false,
        });
        reconciledCount += 1;
      } catch {
        errorCount += 1;
        console.error("Expired scene audio reconciliation failed.", {
          generationId: generation.generationId,
        });
      }
    }

    return {
      scannedCount: generations.length,
      reconciledCount,
      errorCount,
      truncated: generations.length === RECONCILIATION_BATCH_SIZE,
    };
  },
});
