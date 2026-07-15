import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  completeSceneAnalysis,
  failSceneAnalysis,
  markSceneAnalysisRunning,
} from "@/db/commands/scene-commands";
import {
  findApprovedScriptVersion,
  findSceneAnalysisRun,
  findUsageReservation,
} from "@/db/repositories/scenes.repository";
import { calculateTextCostCents } from "@/lib/costs/scene-analysis-cost";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import { validateSceneAnalysisPreflight } from "@/lib/domain/scene-analysis-preflight";
import { OpenAiTextGenerationProvider } from "@/lib/openai/openai-text-generation-provider";
import { classifyOpenAiError } from "@/lib/openai/openai-error";

export const sceneAnalysisTaskPayloadSchema = z.object({
  analysisRunId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
  scriptVersionId: z.uuid(),
  userId: z.uuid(),
});

export const sceneAnalysisTask = task({
  id: "scene-analysis",
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
    payload: z.infer<typeof sceneAnalysisTaskPayloadSchema>,
    { ctx },
  ) => {
    const input = sceneAnalysisTaskPayloadSchema.parse(payload);
    const [run, scriptVersion, reservation] = await Promise.all([
      findSceneAnalysisRun(input),
      findApprovedScriptVersion(input),
      findUsageReservation(input),
    ]);
    if (!run) throw new Error("Analysis run not found.");
    if (run.status === "completed")
      return { analysisRunId: run.id, status: run.status };
    const environment = getSceneAnalysisEnvironment();
    const preflight = validateSceneAnalysisPreflight({
      run,
      reservation,
      expectedFingerprint: createRequestFingerprint(
        environment.REQUEST_FINGERPRINT_SECRET,
        run.finalPrompt,
      ),
      now: new Date(),
    });
    if (!preflight.ok) {
      await failSceneAnalysis({
        analysisRunId: run.id,
        category: preflight.category,
        message: preflight.message,
      });
      return { analysisRunId: run.id, status: "failed" as const };
    }
    if (!scriptVersion) {
      await failSceneAnalysis({
        analysisRunId: run.id,
        category: "script_changed",
        message: "The selected script version is no longer approved.",
      });
      return { analysisRunId: run.id, status: "failed" as const };
    }
    await markSceneAnalysisRunning(run.id, ctx.attempt.number);
    try {
      const provider = new OpenAiTextGenerationProvider();
      const result = await provider.analyzeScenes({
        model: run.model,
        prompt: run.finalPrompt,
      });
      if (result.output.scenes.length > environment.MAX_SCENES_PER_PROJECT)
        throw new Error("OPENAI_INVALID_RESPONSE");
      const actualCostCents = calculateTextCostCents({
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        inputCostPerMillionCents:
          environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
      });
      await completeSceneAnalysis({
        ...input,
        output: result.output,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        actualCostCents,
        providerRequestId: result.requestId,
        durationLimits: {
          minimum: environment.MIN_SCENE_DURATION_MILLISECONDS,
          maximum: environment.MAX_SCENE_DURATION_MILLISECONDS,
        },
      });
      return { analysisRunId: run.id, status: "completed" as const };
    } catch (error) {
      const failure = classifyOpenAiError(error);
      if (
        !failure.retriable ||
        ctx.attempt.number >= (ctx.run.maxAttempts ?? 3)
      ) {
        await failSceneAnalysis({
          analysisRunId: run.id,
          category: failure.category,
          message: failure.message,
        });
        return { analysisRunId: run.id, status: "failed" as const };
      }
      throw error;
    }
  },
});
