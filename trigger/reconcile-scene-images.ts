import { schedules } from "@trigger.dev/sdk";
import { listExpiredActiveSceneImageGenerations } from "@/db/repositories/scene-images.repository";
import { reconcileSceneImageGeneration } from "@/lib/trigger/reconcile-scene-image";

const RECONCILIATION_BATCH_SIZE = 100;

export const reconcileExpiredSceneImagesTask = schedules.task({
  id: "reconcile-expired-scene-images",
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
    const generations = await listExpiredActiveSceneImageGenerations({
      now: new Date(),
      limit: RECONCILIATION_BATCH_SIZE,
    });
    let reconciledCount = 0;
    let errorCount = 0;

    for (const generation of generations) {
      try {
        await reconcileSceneImageGeneration({
          workspaceId: generation.workspaceId,
          projectId: generation.projectId,
          generationId: generation.generationId,
        });
        reconciledCount += 1;
      } catch {
        errorCount += 1;
        console.error("Expired scene image reconciliation failed.", {
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
