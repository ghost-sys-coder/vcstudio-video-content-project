import { describe, expect, it, vi } from "vitest";
import { renderSceneAnalysisPrompt } from "@studio/prompts";
import { assembleScenesFromCreatorSegments } from "@/lib/scenes/assemble-creator-scenes";
import { generateValidatedScenePlan } from "@/lib/scenes/generate-validated-scene-plan";
import type { SceneAnalysisGenerator } from "@/lib/scenes/generate-validated-scene-plan";
import { readScriptForAnalysis } from "@/lib/scenes/script-segment-hints";
import type { SceneAnalysisOutput, SceneContent } from "@/lib/schemas/scene";
import { STRUCTURED_SCRIPT_FIXTURE } from "@/lib/test-utils/structured-script-fixture";

const script = readScriptForAnalysis(STRUCTURED_SCRIPT_FIXTURE);

function scene(narrationText: string, visual = "A calendar."): SceneContent {
  return {
    narrationText,
    visualDescription: visual,
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
  const analyzeScenes = vi.fn(async () => ({
    output,
    requestId: "resp_test",
    inputTokens: 100,
    outputTokens: 50,
  }));
  return { analyzeScenes } as unknown as SceneAnalysisGenerator;
}

async function analyse(output: SceneAnalysisOutput) {
  return generateValidatedScenePlan({
    provider: providerReturning(output),
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
}

describe("assembleScenesFromCreatorSegments", () => {
  it("keeps the model's direction and takes the creator's words", () => {
    const assembly = assembleScenesFromCreatorSegments({
      output: {
        scenes: script.segments.map(() =>
          scene("something else", "Wide shot."),
        ),
      },
      segments: script.segments,
    });
    expect(assembly).not.toBeNull();
    expect(assembly?.output.scenes.map((s) => s.narrationText)).toEqual(
      script.segments.map((s) => s.narration),
    );
    // The visual interpretation is what the model was actually needed for.
    expect(assembly?.output.scenes[0]?.visualDescription).toBe("Wide shot.");
    expect(assembly?.repaired).toBe(script.segments.length);
  });

  it("reports when the model had already reproduced the words exactly", () => {
    const assembly = assembleScenesFromCreatorSegments({
      output: { scenes: script.segments.map((s) => scene(s.narration)) },
      segments: script.segments,
    });
    expect(assembly?.exactFromModel).toBe(script.segments.length);
    expect(assembly?.repaired).toBe(0);
  });

  it("refuses to map a plan with a different number of scenes", () => {
    // The prompt states the segmentation is fixed, so a different count means
    // the model ignored it and its scenes cannot be paired by position.
    expect(
      assembleScenesFromCreatorSegments({
        output: { scenes: [scene("only one")] },
        segments: script.segments,
      }),
    ).toBeNull();
  });

  it("does nothing when the creator gave no segments", () => {
    expect(
      assembleScenesFromCreatorSegments({
        output: { scenes: [scene("anything")] },
        segments: [],
      }),
    ).toBeNull();
  });
});

describe("the production failure can no longer happen", () => {
  it("survives a model that returns the raw document as narration", async () => {
    // Exactly what the deployed worker's repair attempt produced: the markers
    // reproduced as spoken narration. The creator's words are put back, so the
    // run succeeds and nothing reads "[VISUAL]" aloud.
    const result = await analyse({
      scenes: script.segments.map((segment) =>
        scene(`[VISUAL] Fast-paced B-roll. ${segment.narration}`),
      ),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.scenes[0]?.narrationText).toBe(
      script.segments[0]?.narration,
    );
    expect(result.output.scenes[0]?.narrationText).not.toContain("[VISUAL]");
    // And it cost one call, not a first attempt plus a paid repair.
    expect(result.usage.attempts).toBe(1);
  });

  it("survives a model that drifts on a single character", async () => {
    const drifted = script.segments.map((segment) =>
      scene(segment.narration.replace(/’/gu, "'")),
    );
    const result = await analyse({ scenes: drifted });
    expect(result.ok).toBe(true);
    expect(result.usage.attempts).toBe(1);
  });

  it("still refuses a model that ignores the segmentation entirely", async () => {
    // Reading structure must not become a way to accept any output at all.
    const result = await analyse({
      scenes: [scene("A single invented scene.")],
    });
    expect(result.ok).toBe(false);
  });
});
