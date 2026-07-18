import { schedules } from "@trigger.dev/sdk";
import { failVideoRender } from "@/db/commands/video-render-commands";
import { listExpiredActiveVideoRenders } from "@/db/repositories/video-render.repository";

const RECONCILIATION_BATCH_SIZE = 100;

export const reconcileExpiredVideoRenderTask = schedules.task({
  id: "reconcile-expired-video-render",
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
    const renders = await listExpiredActiveVideoRenders({
      now: new Date(),
      limit: RECONCILIATION_BATCH_SIZE,
    });
    let reconciledCount = 0;
    let errorCount = 0;

    for (const render of renders) {
      try {
        await failVideoRender({
          workspaceId: render.workspaceId,
          projectId: render.projectId,
          renderId: render.renderId,
          category: "reservation_expired",
          safeErrorMessage:
            "The render reservation expired before it completed. Start a new render to try again.",
          providerBilled: false,
        });
        reconciledCount += 1;
      } catch {
        errorCount += 1;
        console.error("Expired video render reconciliation failed.", {
          renderId: render.renderId,
        });
      }
    }

    return {
      scannedCount: renders.length,
      reconciledCount,
      errorCount,
      truncated: renders.length === RECONCILIATION_BATCH_SIZE,
    };
  },
});
