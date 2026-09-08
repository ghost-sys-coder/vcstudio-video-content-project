import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import { renderSceneAnalysisRepairPrompt } from "@studio/prompts";
import {
  completeSceneAnalysis,
  failSceneAnalysis,
  failSceneAnalysisWithUsage,
  markSceneAnalysisRunning,
} from "@/db/commands/scene-commands";
import { findProject } from "@/db/repositories/projects.repository";
import {
  findApprovedScriptVersion,
  findSceneAnalysisRun,
  findUsageReservation,
} from "@/db/repositories/scenes.repository";
import { calculateTextCostCents } from "@/lib/costs/scene-analysis-cost";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import {
  checkNarrationCoverage,
  MAX_SCENE_ANALYSIS_REPAIR_ATTEMPTS,
  type NarrationCoverageResult,
} from "@/lib/domain/narration-coverage";
import { validateSceneAnalysisPreflight } from "@/lib/domain/scene-analysis-preflight";
import { NARRATION_FIDELITY_ERROR_CATEGORY } from "@/lib/scenes/scene-analysis-failure";
import type { SceneAnalysisOutput } from "@/lib/schemas/scene";
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
    const [run, scriptVersion, reservation, project] = await Promise.all([
      findSceneAnalysisRun(input),
      findApprovedScriptVersion(input),
      findUsageReservation(input),
      findProject(input),
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

    // Billing accumulates across the first attempt and any repair, so a plan
    // that is ultimately rejected still reconciles the full amount spent.
    let inputTokens = 0;
    let outputTokens = 0;
    let providerRequestId: string | null = null;
    const costOf = () =>
      calculateTextCostCents({
        inputTokens,
        outputTokens,
        inputCostPerMillionCents:
          environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
      });

    try {
      const provider = new OpenAiTextGenerationProvider();
      let prompt = run.finalPrompt;
      let output: SceneAnalysisOutput | null = null;
      let coverage: NarrationCoverageResult | null = null;

      for (
        let attempt = 0;
        attempt <= MAX_SCENE_ANALYSIS_REPAIR_ATTEMPTS;
        attempt += 1
      ) {
        const result = await provider.analyzeScenes({
          model: run.model,
          prompt,
        });
        inputTokens += result.inputTokens;
        outputTokens += result.outputTokens;
        providerRequestId = result.requestId;
        if (result.output.scenes.length > environment.MAX_SCENES_PER_PROJECT)
          throw new Error("OPENAI_INVALID_RESPONSE");

        output = result.output;
        coverage = checkNarrationCoverage({
          approvedScript: scriptVersion.content,
          sceneNarrations: result.output.scenes.map(
            (scene) => scene.narrationText,
          ),
        });
        if (coverage.ok) break;
        if (attempt === MAX_SCENE_ANALYSIS_REPAIR_ATTEMPTS) break;
        prompt = renderSceneAnalysisRepairPrompt({
          script: scriptVersion.content,
          maximumScenes: environment.MAX_SCENES_PER_PROJECT,
          aspectRatio: project?.aspectRatio ?? "16:9",
          language: project?.language ?? "en",
          discrepancy: coverage.summary,
        });
      }

      if (!output || !coverage) throw new Error("OPENAI_INVALID_RESPONSE");

      if (!coverage.ok) {
        // Paid output that cannot become the active scene plan. The previous
        // plan is left in place precisely because nothing is inserted here.
        await failSceneAnalysisWithUsage({
          analysisRunId: run.id,
          category: NARRATION_FIDELITY_ERROR_CATEGORY,
          message: coverage.summary,
          providerRequestId,
          inputTokens,
          outputTokens,
          actualCostCents: costOf(),
        });
        return { analysisRunId: run.id, status: "failed" as const };
      }

      await completeSceneAnalysis({
        ...input,
        output,
        inputTokens,
        outputTokens,
        actualCostCents: costOf(),
        providerRequestId: providerRequestId ?? "",
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
        // Tokens may already have been billed before the throw, so record what
        // was spent rather than releasing the reservation to zero.
        if (inputTokens > 0 || outputTokens > 0)
          await failSceneAnalysisWithUsage({
            analysisRunId: run.id,
            category: failure.category,
            message: failure.message,
            providerRequestId,
            inputTokens,
            outputTokens,
            actualCostCents: costOf(),
          });
        else
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
