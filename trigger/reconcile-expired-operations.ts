import { logger, schedules } from "@trigger.dev/sdk";
import { failSceneAudioGeneration } from "@/db/commands/scene-audio-commands";
import { releaseExpiredMarketingReservation } from "@/db/commands/marketing-usage-commands";
import { failMarketingToolCall } from "@/db/commands/marketing-chat-tool-call-commands";
import { appendDeferredToolResultMessage } from "@/db/commands/marketing-chat-commands";
import { failVideoRender } from "@/db/commands/video-render-commands";
import { findMarketingToolCallByRun } from "@/db/repositories/marketing-chat.repository";
import { listExpiredMarketingReservations } from "@/db/repositories/marketing-usage.repository";
import { upsertTaskHeartbeat } from "@/db/repositories/readiness.repository";
import { listExpiredActiveSceneAudioGenerations } from "@/db/repositories/scene-audio.repository";
import { listExpiredActiveSceneImageGenerations } from "@/db/repositories/scene-images.repository";
import { listExpiredActiveVideoRenders } from "@/db/repositories/video-render.repository";
import { reconcileSceneImageGeneration } from "@/lib/trigger/reconcile-scene-image";

// Retain an existing Trigger.dev schedule identity so this consolidation does
// not consume another schedule slot on the current plan.
const TASK_ID = "reconcile-marketing-usage";
const BATCH_SIZE = 100;

/**
 * One low-frequency recovery pass for operations that should already have
 * completed. Normal task completion remains immediate; this is only the safety
 * net for a worker that disappeared before settling its database state.
 *
 * Keeping the recovery queries in one task creates long query-free windows in
 * which Neon's compute can scale to zero. The heartbeat is recorded here too,
 * so readiness monitoring does not need a separate database-writing schedule.
 */
export const reconcileExpiredOperationsTask = schedules.task({
  id: TASK_ID,
  cron: "*/30 * * * *",
  queue: { name: "media-processing", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async () => {
    const startedAt = new Date();
    const environment = process.env.READINESS_ENVIRONMENT ?? "development";
    await upsertTaskHeartbeat({
      taskId: TASK_ID,
      environment,
      startedAt,
      completedAt: null,
      outcome: "running",
      safeMessage: null,
    });

    let errorCount = 0;
    let imageCount = 0;
    let audioCount = 0;
    let renderCount = 0;
    let marketingCount = 0;

    try {
      const now = new Date();
      const [images, audio, renders, reservations] = await Promise.all([
        listExpiredActiveSceneImageGenerations({ now, limit: BATCH_SIZE }),
        listExpiredActiveSceneAudioGenerations({ now, limit: BATCH_SIZE }),
        listExpiredActiveVideoRenders({ now, limit: BATCH_SIZE }),
        listExpiredMarketingReservations({ now, limit: BATCH_SIZE }),
      ]);

      for (const generation of images) {
        try {
          await reconcileSceneImageGeneration({
            workspaceId: generation.workspaceId,
            projectId: generation.projectId,
            generationId: generation.generationId,
          });
          imageCount += 1;
        } catch {
          errorCount += 1;
          logger.error("Expired scene image reconciliation failed.", {
            generationId: generation.generationId,
          });
        }
      }

      for (const generation of audio) {
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
          audioCount += 1;
        } catch {
          errorCount += 1;
          logger.error("Expired scene audio reconciliation failed.", {
            generationId: generation.generationId,
          });
        }
      }

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
          renderCount += 1;
        } catch {
          errorCount += 1;
          logger.error("Expired video render reconciliation failed.", {
            renderId: render.renderId,
          });
        }
      }

      for (const reservation of reservations) {
        try {
          const released = await releaseExpiredMarketingReservation({
            reservationId: reservation.id,
            now,
          });
          if (!released) continue;
          marketingCount += 1;
          const toolCall = await findMarketingToolCallByRun({
            workspaceId: reservation.workspaceId,
            runId: reservation.runId,
          });
          if (!toolCall) continue;
          const message =
            "This background task stopped before it finished. Please try again.";
          const failed = await failMarketingToolCall({
            workspaceId: reservation.workspaceId,
            id: toolCall.id,
            category: "reservation_expired",
            message,
            actualCostCents: 0,
          });
          if (failed)
            await appendDeferredToolResultMessage({
              workspaceId: reservation.workspaceId,
              threadId: toolCall.threadId,
              runId: reservation.runId,
              part: {
                type: "data-toolResult",
                data: {
                  skillKey: toolCall.skillKey,
                  summary: message,
                  failed: true,
                },
              },
              plainText: message,
              costCents: 0,
            });
        } catch {
          errorCount += 1;
          logger.error("Expired marketing reservation release failed.", {
            reservationId: reservation.id,
          });
        }
      }

      const result = {
        imageCount,
        audioCount,
        renderCount,
        marketingCount,
        errorCount,
      };
      await upsertTaskHeartbeat({
        taskId: TASK_ID,
        environment,
        startedAt,
        completedAt: new Date(),
        outcome: errorCount > 0 ? "failed" : "succeeded",
        safeMessage:
          errorCount > 0
            ? `${errorCount} recovery operation${errorCount === 1 ? "" : "s"} failed.`
            : null,
      });
      return result;
    } catch (error) {
      await upsertTaskHeartbeat({
        taskId: TASK_ID,
        environment,
        startedAt,
        completedAt: new Date(),
        outcome: "failed",
        safeMessage: "The recovery sweep did not complete.",
      });
      throw error;
    }
  },
});
