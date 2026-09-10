import { describe, expect, it, vi } from "vitest";
import { renderSceneAnalysisPrompt } from "@studio/prompts";
import { generateValidatedScenePlan } from "@/lib/scenes/generate-validated-scene-plan";
import type { SceneAnalysisGenerator } from "@/lib/scenes/generate-validated-scene-plan";
import { readScriptForAnalysis } from "@/lib/scenes/script-segment-hints";
import type { SceneAnalysisOutput, SceneContent } from "@/lib/schemas/scene";
import {
  PLAIN_SCRIPT_FIXTURE,
  STRUCTURED_SCRIPT_FIXTURE,
} from "@/lib/test-utils/structured-script-fixture";

function scene(narrationText: string): SceneContent {
  return {
    narrationText,
    visualDescription: "A calendar burns away.",
    locationDescription: "A studio.",
    actionDescription: "The host speaks.",
    cameraShot: "medium",
    cameraAngle: "eye level",
    cameraMotion: "static",
    emotionalTone: "urgent",
    characterNames: [],
    propNames: [],
    continuityNotes: "",
    estimatedDurationMilliseconds: 4000,
  };
}

function providerReturning(output: SceneAnalysisOutput) {
  const prompts: string[] = [];
  const analyzeScenes = vi.fn(async (input: { prompt: string }) => {
    prompts.push(input.prompt);
    return {
      output,
      requestId: "resp_test",
      inputTokens: 100,
      outputTokens: 50,
    };
  });
  return { provider: { analyzeScenes } as SceneAnalysisGenerator, prompts };
}

const script = readScriptForAnalysis(STRUCTURED_SCRIPT_FIXTURE);

async function analyse(output: SceneAnalysisOutput) {
  const { provider, prompts } = providerReturning(output);
  const result = await generateValidatedScenePlan({
    provider,
    model: "test-model",
    initialPrompt: renderSceneAnalysisPrompt({
      script: script.narration,
      maximumScenes: 50,
      aspectRatio: "16:9",
      language: "en",
      segments: script.segments,
    }),
    approvedScript: script.narration,
    maximumScenes: 50,
    aspectRatio: "16:9",
    language: "en",
    segments: script.segments,
  });
  return { result, prompts };
}

describe("a pasted script reaches analysis as narration, not as a document", () => {
  it("accepts a plan that returns the creator's own segments verbatim", async () => {
    // The creator already decided the boundaries, so returning them unchanged
    // is the correct answer and must pass fidelity on the first attempt.
    const { result } = await analyse({
      scenes: script.segments.map((segment) => scene(segment.narration)),
    });
    expect(result.ok).toBe(true);
    expect(result.usage.attempts).toBe(1);
  });

  it("would have failed if the raw document were used as the baseline", async () => {
    // The defect this fixes. Validating against the whole document asks the
    // model to reproduce "[VISUAL] Fast-paced..." as spoken narration, which
    // no correct plan ever will, so every structured script would be rejected
    // and charged for twice before failing.
    const { provider } = providerReturning({
      scenes: script.segments.map((segment) => scene(segment.narration)),
    });
    const result = await generateValidatedScenePlan({
      provider,
      model: "test-model",
      initialPrompt: "irrelevant",
      approvedScript: STRUCTURED_SCRIPT_FIXTURE,
      maximumScenes: 50,
      aspectRatio: "16:9",
      language: "en",
    });
    expect(result.ok).toBe(false);
  });

  it("still rejects a plan that drops one of the creator's segments", async () => {
    // Reading structure must not weaken the fidelity guarantee.
    const { result } = await analyse({
      scenes: script.segments
        .slice(0, -1)
        .map((segment) => scene(segment.narration)),
    });
    expect(result.ok).toBe(false);
  });

  it("still rejects a plan that speaks the production direction", async () => {
    const withDirection = script.segments.map((segment, index) =>
      scene(
        index === 0
          ? `[VISUAL] Fast-paced B-roll. ${segment.narration}`
          : segment.narration,
      ),
    );
    const { result } = await analyse({ scenes: withDirection });
    expect(result.ok).toBe(false);
  });
});

describe("the prompt tells the model the segmentation is already decided", () => {
  it("states the creator's plan and forbids re-splitting it", async () => {
    const { prompts } = await analyse({
      scenes: script.segments.map((segment) => scene(segment.narration)),
    });
    const prompt = prompts[0] ?? "";
    expect(prompt).toContain("The creator already divided this script into 3");
    expect(prompt).toContain("Do not re-split, merge, reorder");
    expect(prompt).toContain("Hook: The 7-Day Reset");
    expect(prompt).toContain("0:00 - 1:15");
  });

  it("gives the creator's visual direction as direction, never as narration", async () => {
    const { prompts } = await analyse({
      scenes: script.segments.map((segment) => scene(segment.narration)),
    });
    const prompt = prompts[0] ?? "";
    expect(prompt).toContain("VISUAL: Fast-paced");
    expect(prompt).toContain("Never copy it into narrationText");
  });
});

describe("an ordinary script is unaffected", () => {
  it("produces no segment hints and keeps the original wording as the baseline", () => {
    const plain = readScriptForAnalysis(PLAIN_SCRIPT_FIXTURE);
    expect(plain.segments).toEqual([]);
    expect(plain.narration).toBe(PLAIN_SCRIPT_FIXTURE.trim());
  });

  it("renders the prompt without a segment plan", () => {
    const plain = readScriptForAnalysis(PLAIN_SCRIPT_FIXTURE);
    const prompt = renderSceneAnalysisPrompt({
      script: plain.narration,
      maximumScenes: 50,
      aspectRatio: "16:9",
      language: "en",
      segments: plain.segments,
    });
    expect(prompt).not.toContain("The creator already divided");
    expect(prompt).toContain("Convert the approved narration script");
  });
});

describe("segment hints are withheld when they cannot be honoured", () => {
  it("declines to fix a segmentation where a segment has nothing spoken", () => {
    // A silent scene would fail fidelity immediately, so the creator's
    // segmentation is not imposed when one segment is direction only.
    const parsed = readScriptForAnalysis(
      "[0:00 - 0:10] Cold open\n[VISUAL] A door opens.\n\n[0:10 - 0:20] Line\n[VOICEOVER] Hello there.",
    );
    expect(parsed.structure.segments).toHaveLength(2);
    expect(parsed.segments).toEqual([]);
    // The narration is still cleaned, which is the part that always applies.
    expect(parsed.narration).toBe("Hello there.");
  });
});
