import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  completeScriptGeneration,
  failScriptGeneration,
  markScriptGenerationRunning,
} from "@/db/commands/script-generation-commands";
import {
  findScriptGenerationReservation,
  findScriptGenerationRun,
} from "@/db/repositories/script-generation.repository";
import { calculateTextCostCents } from "@/lib/costs/scene-analysis-cost";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { classifyOpenAiError } from "@/lib/openai/openai-error";
import { OpenAiTextGenerationProvider } from "@/lib/openai/openai-text-generation-provider";

export const scriptGenerationTaskPayloadSchema = z.object({
  scriptGenerationRunId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

export const scriptGenerationTask = task({
  id: "script-generation",
  queue: { name: "ai-text", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async (
    payload: z.infer<typeof scriptGenerationTaskPayloadSchema>,
    { ctx },
  ) => {
    const input = scriptGenerationTaskPayloadSchema.parse(payload);
    const run = await findScriptGenerationRun(input);
    if (!run) throw new Error("Script generation run not found.");
    if (run.status === "completed")
      return { scriptGenerationRunId: run.id, status: run.status };
    if (run.status === "failed")
      return { scriptGenerationRunId: run.id, status: run.status };

    const environment = getSceneAnalysisEnvironment();
    const reservation = await findScriptGenerationReservation({
      workspaceId: input.workspaceId,
      scriptGenerationRunId: run.id,
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
      await failScriptGeneration({
        scriptGenerationRunId: run.id,
        category: "preflight_failed",
        message:
          "The script generation reservation was not available. Start a new generation to try again.",
      });
      return { scriptGenerationRunId: run.id, status: "failed" as const };
    }

    await markScriptGenerationRunning({
      scriptGenerationRunId: run.id,
      attemptCount: ctx.attempt.number,
    });
    try {
      const provider = new OpenAiTextGenerationProvider();
      const result = await provider.generateScript({
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
      await completeScriptGeneration({
        scriptGenerationRunId: run.id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        generatedContent: result.output.script,
        suggestedTitle: result.output.suggestedTitle,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        actualCostCents,
        providerRequestId: result.requestId,
      });
      return { scriptGenerationRunId: run.id, status: "completed" as const };
    } catch (error) {
      const failure = classifyOpenAiError(error);
      if (
        !failure.retriable ||
        ctx.attempt.number >= (ctx.run.maxAttempts ?? 3)
      ) {
        await failScriptGeneration({
          scriptGenerationRunId: run.id,
          category: failure.category,
          message: failure.message,
        });
        return { scriptGenerationRunId: run.id, status: "failed" as const };
      }
      throw error;
    }
  },
});
