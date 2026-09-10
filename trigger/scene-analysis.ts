import { task } from "@trigger.dev/sdk";
import { z } from "zod";
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
import { validateSceneAnalysisPreflight } from "@/lib/domain/scene-analysis-preflight";
import { readScriptForAnalysis } from "@/lib/scenes/script-segment-hints";
import { generateValidatedScenePlan } from "@/lib/scenes/generate-validated-scene-plan";
import { NARRATION_FIDELITY_ERROR_CATEGORY } from "@/lib/scenes/scene-analysis-failure";
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

    // Usage is tracked here as well as inside the generator so a throw
    // mid-flight still reconciles whatever the provider already billed.
    let usage = {
      inputTokens: 0,
      outputTokens: 0,
      providerRequestId: null as string | null,
    };
    const costOf = () =>
      calculateTextCostCents({
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        inputCostPerMillionCents:
          environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
      });

    const script = readScriptForAnalysis(scriptVersion.content);

    try {
      const plan = await generateValidatedScenePlan({
        provider: new OpenAiTextGenerationProvider(),
        model: run.model,
        initialPrompt: run.finalPrompt,
        // The spoken text, not the whole document: a pasted script's [VISUAL]
        // and [TEXT OVERLAY] direction is not narration and must not be part
        // of what the plan is held to reproduce.
        approvedScript: script.narration,
        segments: script.segments,
        maximumScenes: environment.MAX_SCENES_PER_PROJECT,
        aspectRatio: project?.aspectRatio ?? "16:9",
        language: project?.language ?? "en",
      });
      usage = plan.usage;

      if (!plan.ok) {
        // Paid output that cannot become the active scene plan. The previous
        // plan is left in place precisely because nothing is inserted here.
        await failSceneAnalysisWithUsage({
          analysisRunId: run.id,
          category: NARRATION_FIDELITY_ERROR_CATEGORY,
          message: plan.coverage.summary,
          providerRequestId: usage.providerRequestId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          actualCostCents: costOf(),
        });
        return { analysisRunId: run.id, status: "failed" as const };
      }

      await completeSceneAnalysis({
        ...input,
        output: plan.output,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        actualCostCents: costOf(),
        providerRequestId: usage.providerRequestId ?? "",
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
        if (usage.inputTokens > 0 || usage.outputTokens > 0)
          await failSceneAnalysisWithUsage({
            analysisRunId: run.id,
            category: failure.category,
            message: failure.message,
            providerRequestId: usage.providerRequestId,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
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
