import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  completeTitleGeneration,
  failTitleGeneration,
  markTitleGenerationRunning,
} from "@/db/commands/title-generation-commands";
import {
  findTitleGenerationReservation,
  findTitleGenerationRun,
} from "@/db/repositories/title-generation.repository";
import { calculateTextCostCents } from "@/lib/costs/scene-analysis-cost";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { classifyOpenAiError } from "@/lib/openai/openai-error";
import { OpenAiTextGenerationProvider } from "@/lib/openai/openai-text-generation-provider";

export const titleGenerationTaskPayloadSchema = z.object({
  titleGenerationRunId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

export const titleGenerationTask = task({
  id: "title-generation",
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
    payload: z.infer<typeof titleGenerationTaskPayloadSchema>,
    { ctx },
  ) => {
    const input = titleGenerationTaskPayloadSchema.parse(payload);
    const run = await findTitleGenerationRun(input);
    if (!run) throw new Error("Title generation run not found.");
    if (run.status === "completed")
      return { titleGenerationRunId: run.id, status: run.status };
    if (run.status === "failed")
      return { titleGenerationRunId: run.id, status: run.status };

    const environment = getSceneAnalysisEnvironment();
    const reservation = await findTitleGenerationReservation({
      workspaceId: input.workspaceId,
      titleGenerationRunId: run.id,
    });
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
      await failTitleGeneration({
        titleGenerationRunId: run.id,
        category: "preflight_failed",
        message:
          "The title generation reservation was not available. Start a new generation to try again.",
      });
      return { titleGenerationRunId: run.id, status: "failed" as const };
    }

    await markTitleGenerationRunning({
      titleGenerationRunId: run.id,
      attemptCount: ctx.attempt.number,
    });
    try {
      const provider = new OpenAiTextGenerationProvider();
      const result = await provider.generateTitles({
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
      await completeTitleGeneration({
        titleGenerationRunId: run.id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        platform: run.platform,
        options: result.output.titles.map((title) => ({
          text: title.text,
          rationale: title.rationale,
          hookType: title.hookType,
        })),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        actualCostCents,
        providerRequestId: result.requestId,
      });
      return { titleGenerationRunId: run.id, status: "completed" as const };
    } catch (error) {
      const failure = classifyOpenAiError(error);
      if (
        !failure.retriable ||
        ctx.attempt.number >= (ctx.run.maxAttempts ?? 3)
      ) {
        await failTitleGeneration({
          titleGenerationRunId: run.id,
          category: failure.category,
          message: failure.message,
        });
        return { titleGenerationRunId: run.id, status: "failed" as const };
      }
      throw error;
    }
  },
});
