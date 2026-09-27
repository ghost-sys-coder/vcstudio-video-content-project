import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  completeChapterGeneration,
  failChapterGeneration,
  markChapterGenerationRunning,
} from "@/db/commands/chapter-generation-commands";
import {
  findChapterGenerationReservation,
  findChapterGenerationRun,
} from "@/db/repositories/chapter-generation.repository";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import { buildChaptersFromScenePicks } from "@/lib/chapters/youtube-chapters";
import { calculateTextCostCents } from "@/lib/costs/scene-analysis-cost";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { classifyOpenAiError } from "@/lib/openai/openai-error";
import { OpenAiTextGenerationProvider } from "@/lib/openai/openai-text-generation-provider";

export const chapterGenerationTaskPayloadSchema = z.object({
  chapterGenerationRunId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

export const chapterGenerationTask = task({
  id: "chapter-generation",
  queue: { name: "ai-text", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 180,
  run: async (
    payload: z.infer<typeof chapterGenerationTaskPayloadSchema>,
    { ctx },
  ) => {
    const input = chapterGenerationTaskPayloadSchema.parse(payload);
    const run = await findChapterGenerationRun({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      chapterGenerationRunId: input.chapterGenerationRunId,
    });
    if (!run) throw new Error("Chapter generation run not found.");
    if (run.status === "completed" || run.status === "failed")
      return { chapterGenerationRunId: run.id, status: run.status };

    const environment = getSceneAnalysisEnvironment();
    const [reservation, render] = await Promise.all([
      findChapterGenerationReservation({
        workspaceId: input.workspaceId,
        chapterGenerationRunId: run.id,
      }),
      findVideoRender({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        renderId: run.renderId,
      }),
    ]);
    const expectedFingerprint = createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      run.finalPrompt,
    );
    if (
      !reservation ||
      reservation.status !== "pending" ||
      reservation.expiresAt.getTime() < Date.now() ||
      reservation.reservedCostCents !== run.estimatedCostCents ||
      run.requestFingerprint !== expectedFingerprint
    ) {
      await failChapterGeneration({
        chapterGenerationRunId: run.id,
        category: "preflight_failed",
        message:
          "The chapter generation reservation was not available. Start a new generation to try again.",
      });
      return { chapterGenerationRunId: run.id, status: "failed" as const };
    }
    if (!render || render.status !== "succeeded") {
      await failChapterGeneration({
        chapterGenerationRunId: run.id,
        category: "render_unavailable",
        message: "The render these chapters were for is no longer available.",
      });
      return { chapterGenerationRunId: run.id, status: "failed" as const };
    }

    await markChapterGenerationRunning({
      chapterGenerationRunId: run.id,
      attemptCount: ctx.attempt.number,
    });
    try {
      const result = await new OpenAiTextGenerationProvider().generateChapters({
        model: run.model,
        prompt: run.finalPrompt,
      });
      const actualCostCents = calculateTextCostCents({
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        inputCostPerMillionCents:
          environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
      });
      const snapshot = render.timelineSnapshot;
      // Times come from the render, never from the model. Whatever the list
      // looks like after repair is kept, even if it still breaks a rule: the
      // call has been paid for, and the editor shows exactly what to fix.
      const chapters = buildChaptersFromScenePicks({
        picks: result.output.chapters,
        scenes: snapshot.scenes.map((scene) => ({
          sceneNumber: scene.sceneNumber,
          startMilliseconds: scene.startMilliseconds,
        })),
        videoDurationMilliseconds: snapshot.totalDurationMilliseconds,
      });
      await completeChapterGeneration({
        chapterGenerationRunId: run.id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        renderId: run.renderId,
        userId: run.requestedByUserId,
        chapters,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        actualCostCents,
        providerRequestId: result.requestId,
      });
      return { chapterGenerationRunId: run.id, status: "completed" as const };
    } catch (error) {
      const failure = classifyOpenAiError(error);
      if (
        !failure.retriable ||
        ctx.attempt.number >= (ctx.run.maxAttempts ?? 3)
      ) {
        await failChapterGeneration({
          chapterGenerationRunId: run.id,
          category: failure.category,
          message: failure.message,
        });
        return { chapterGenerationRunId: run.id, status: "failed" as const };
      }
      throw error;
    }
  },
});
