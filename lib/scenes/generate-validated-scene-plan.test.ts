import { describe, expect, it, vi } from "vitest";
import { generateValidatedScenePlan } from "@/lib/scenes/generate-validated-scene-plan";
import type { SceneAnalysisGenerator } from "@/lib/scenes/generate-validated-scene-plan";
import type { SceneAnalysisOutput, SceneContent } from "@/lib/schemas/scene";

const SCRIPT = "First passage. Second passage. Third passage.";

function scene(narrationText: string): SceneContent {
  return {
    narrationText,
    visualDescription: "A desk.",
    locationDescription: "An office.",
    actionDescription: "A pen rests.",
    cameraShot: "medium",
    cameraAngle: "eye level",
    cameraMotion: "static",
    emotionalTone: "calm",
    characterNames: [],
    propNames: [],
    continuityNotes: "",
    estimatedDurationMilliseconds: 4000,
  };
}

function plan(...narrations: string[]): SceneAnalysisOutput {
  return { scenes: narrations.map(scene) };
}

const FAITHFUL = plan("First passage.", "Second passage.", "Third passage.");
const DROPS_A_PASSAGE = plan("First passage.", "Third passage.");

/** A provider that returns queued responses and records the prompts it saw. */
function fakeProvider(
  responses: Array<{
    output: SceneAnalysisOutput;
    requestId?: string;
    inputTokens?: number;
    outputTokens?: number;
  }>,
) {
  const prompts: string[] = [];
  const analyzeScenes = vi.fn(async (input: { prompt: string }) => {
    prompts.push(input.prompt);
    const next = responses.shift();
    if (!next) throw new Error("Provider called more times than expected.");
    return {
      output: next.output,
      requestId: next.requestId ?? "resp_default",
      inputTokens: next.inputTokens ?? 100,
      outputTokens: next.outputTokens ?? 50,
    };
  });
  return {
    provider: { analyzeScenes } as SceneAnalysisGenerator,
    analyzeScenes,
    prompts,
  };
}

function run(provider: SceneAnalysisGenerator, overrides = {}) {
  return generateValidatedScenePlan({
    provider,
    model: "test-model",
    initialPrompt: "INITIAL PROMPT",
    approvedScript: SCRIPT,
    maximumScenes: 50,
    aspectRatio: "16:9",
    language: "en",
    ...overrides,
  });
}

describe("generateValidatedScenePlan", () => {
  it("accepts a faithful plan without paying for a repair", async () => {
    const { provider, analyzeScenes } = fakeProvider([{ output: FAITHFUL }]);
    const result = await run(provider);

    expect(result.ok).toBe(true);
    expect(analyzeScenes).toHaveBeenCalledTimes(1);
    if (!result.ok) return;
    expect(result.usage.attempts).toBe(1);
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
  });

  it("repairs a rejected plan and returns the corrected one", async () => {
    const { provider, analyzeScenes, prompts } = fakeProvider([
      { output: DROPS_A_PASSAGE, requestId: "resp_1" },
      { output: FAITHFUL, requestId: "resp_2" },
    ]);
    const result = await run(provider);

    expect(result.ok).toBe(true);
    expect(analyzeScenes).toHaveBeenCalledTimes(2);
    expect(prompts[0]).toBe("INITIAL PROMPT");
    // The repair prompt must quote the discrepancy, or the retry is wasted.
    expect(prompts[1]).toContain("Second passage.");
    expect(prompts[1]).toContain("rejection");
  });

  it("bills every attempt, not just the last", async () => {
    const { provider } = fakeProvider([
      { output: DROPS_A_PASSAGE, inputTokens: 100, outputTokens: 40 },
      { output: FAITHFUL, inputTokens: 120, outputTokens: 60 },
    ]);
    const result = await run(provider);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usage.inputTokens).toBe(220);
    expect(result.usage.outputTokens).toBe(100);
    expect(result.usage.attempts).toBe(2);
  });

  it("stops after the bounded repair and reports the discrepancy with usage", async () => {
    const { provider, analyzeScenes } = fakeProvider([
      { output: DROPS_A_PASSAGE, requestId: "resp_1" },
      { output: DROPS_A_PASSAGE, requestId: "resp_2" },
    ]);
    const result = await run(provider);

    expect(analyzeScenes).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("narration_fidelity");
    expect(result.coverage.discrepancies[0]?.kind).toBe("missing_narration");
    expect(result.usage.attempts).toBe(2);
    expect(result.usage.inputTokens).toBe(200);
    expect(result.usage.providerRequestId).toBe("resp_2");
  });

  it("never exceeds the configured repair bound", async () => {
    const { provider, analyzeScenes } = fakeProvider([
      { output: DROPS_A_PASSAGE },
      { output: DROPS_A_PASSAGE },
      { output: DROPS_A_PASSAGE },
    ]);
    const result = await run(provider, { maximumRepairAttempts: 2 });

    expect(analyzeScenes).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
  });

  it("makes exactly one call when repair is disabled", async () => {
    const { provider, analyzeScenes } = fakeProvider([
      { output: DROPS_A_PASSAGE },
    ]);
    const result = await run(provider, { maximumRepairAttempts: 0 });

    expect(analyzeScenes).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.usage.attempts).toBe(1);
  });

  it("rejects a plan with more scenes than the configured maximum", async () => {
    const { provider } = fakeProvider([{ output: FAITHFUL }]);
    await expect(run(provider, { maximumScenes: 2 })).rejects.toThrow(
      "OPENAI_INVALID_RESPONSE",
    );
  });

  it("propagates a provider failure instead of reporting a fidelity problem", async () => {
    const analyzeScenes = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(
      run({ analyzeScenes } as unknown as SceneAnalysisGenerator),
    ).rejects.toThrow("network down");
  });

  it("does not repair a plan that only reorders scenes if the retry fixes it", async () => {
    const { provider } = fakeProvider([
      { output: plan("Third passage.", "First passage.", "Second passage.") },
      { output: FAITHFUL },
    ]);
    const result = await run(provider);
    expect(result.ok).toBe(true);
  });
});
