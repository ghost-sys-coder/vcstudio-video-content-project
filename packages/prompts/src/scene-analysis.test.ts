import { describe, expect, it } from "vitest";
import {
  renderSceneAnalysisPrompt,
  renderSceneAnalysisRepairPrompt,
  SCENE_ANALYSIS_PROMPT_VERSION,
} from "./scene-analysis";

const input = {
  script: "Hello world.",
  maximumScenes: 10,
  aspectRatio: "16:9",
  language: "en",
};

describe("scene analysis prompt", () => {
  it("renders deterministically with a version", () => {
    expect(renderSceneAnalysisPrompt(input)).toBe(
      renderSceneAnalysisPrompt(input),
    );
    expect(SCENE_ANALYSIS_PROMPT_VERSION).toBe("scene-analysis-v2");
    expect(renderSceneAnalysisPrompt(input)).toContain("Hello world.");
  });

  it("states the coverage contract the validator enforces", () => {
    const prompt = renderSceneAnalysisPrompt(input);
    expect(prompt).toContain("exactly once");
    expect(prompt).toContain("character for character");
    expect(prompt).toContain("Do not change punctuation");
  });
});

describe("scene analysis repair prompt", () => {
  const repairInput = { ...input, discrepancy: "Scene 2 skips 40 characters." };

  it("renders deterministically and quotes the rejection reason", () => {
    const prompt = renderSceneAnalysisRepairPrompt(repairInput);
    expect(prompt).toBe(renderSceneAnalysisRepairPrompt(repairInput));
    expect(prompt).toContain("Scene 2 skips 40 characters.");
    expect(prompt).toContain("Hello world.");
  });

  it("repeats the same coverage contract as the first attempt", () => {
    const prompt = renderSceneAnalysisRepairPrompt(repairInput);
    expect(prompt).toContain("exactly once");
    expect(prompt).toContain("character for character");
  });

  it("differs from the first-attempt prompt", () => {
    expect(renderSceneAnalysisRepairPrompt(repairInput)).not.toBe(
      renderSceneAnalysisPrompt(input),
    );
  });
});
