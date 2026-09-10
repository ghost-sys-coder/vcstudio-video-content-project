import {
  renderSceneAnalysisRepairPrompt,
  type SceneAnalysisSegmentHint,
} from "@studio/prompts";
import {
  checkNarrationCoverage,
  MAX_SCENE_ANALYSIS_REPAIR_ATTEMPTS,
  type NarrationCoverageResult,
} from "@/lib/domain/narration-coverage";
import type { SceneAnalysisProviderResult } from "@/lib/openai/text-generation-provider";
import type { SceneAnalysisOutput } from "@/lib/schemas/scene";

/** The single provider capability this needs, so tests can supply a fake. */
export interface SceneAnalysisGenerator {
  analyzeScenes(input: {
    model: string;
    prompt: string;
  }): Promise<SceneAnalysisProviderResult>;
}

export interface SceneAnalysisUsage {
  inputTokens: number;
  outputTokens: number;
  providerRequestId: string | null;
  /** Provider calls made, including the first attempt. Always at least one. */
  attempts: number;
}

export type ValidatedScenePlanResult =
  | { ok: true; output: SceneAnalysisOutput; usage: SceneAnalysisUsage }
  | {
      ok: false;
      reason: "narration_fidelity";
      coverage: Extract<NarrationCoverageResult, { ok: false }>;
      usage: SceneAnalysisUsage;
    };

/**
 * Generates a scene plan and holds it to the approved script.
 *
 * Lifted out of the Trigger.dev task so the retry-and-validate policy can be
 * exercised against a fake provider: the worker keeps the parts that need a
 * real database and queue, this keeps the decision about whether output is
 * acceptable and how many times it is worth paying to ask again.
 *
 * Usage is accumulated across every attempt and returned on both branches,
 * because a rejected plan still costs money and the caller has to reconcile it.
 * `OPENAI_INVALID_RESPONSE` is thrown rather than returned: it means the
 * response did not parse at all, which the existing error classifier already
 * handles as a non-retriable provider fault.
 */
export async function generateValidatedScenePlan(input: {
  provider: SceneAnalysisGenerator;
  model: string;
  initialPrompt: string;
  approvedScript: string;
  maximumScenes: number;
  aspectRatio: string;
  language: string;
  maximumRepairAttempts?: number;
  /**
   * The creator's own segmentation, when their script stated it. Repeated on
   * the retry so a correction cannot quietly re-segment their script.
   */
  segments?: SceneAnalysisSegmentHint[];
}): Promise<ValidatedScenePlanResult> {
  const maximumRepairAttempts =
    input.maximumRepairAttempts ?? MAX_SCENE_ANALYSIS_REPAIR_ATTEMPTS;
  const usage: SceneAnalysisUsage = {
    inputTokens: 0,
    outputTokens: 0,
    providerRequestId: null,
    attempts: 0,
  };
  let prompt = input.initialPrompt;
  let lastRejection: Extract<NarrationCoverageResult, { ok: false }> | null =
    null;

  for (let attempt = 0; attempt <= maximumRepairAttempts; attempt += 1) {
    const result = await input.provider.analyzeScenes({
      model: input.model,
      prompt,
    });
    usage.inputTokens += result.inputTokens;
    usage.outputTokens += result.outputTokens;
    usage.providerRequestId = result.requestId;
    usage.attempts += 1;

    if (result.output.scenes.length > input.maximumScenes)
      throw new Error("OPENAI_INVALID_RESPONSE");

    const coverage = checkNarrationCoverage({
      approvedScript: input.approvedScript,
      sceneNarrations: result.output.scenes.map((scene) => scene.narrationText),
    });
    if (coverage.ok) return { ok: true, output: result.output, usage };

    lastRejection = coverage;
    if (attempt === maximumRepairAttempts) break;
    prompt = renderSceneAnalysisRepairPrompt({
      script: input.approvedScript,
      maximumScenes: input.maximumScenes,
      aspectRatio: input.aspectRatio,
      language: input.language,
      discrepancy: coverage.summary,
      segments: input.segments,
    });
  }

  // Unreachable unless the loop never ran, which the bounds prevent.
  if (!lastRejection) throw new Error("OPENAI_INVALID_RESPONSE");
  return {
    ok: false,
    reason: "narration_fidelity",
    coverage: lastRejection,
    usage,
  };
}
