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
    expect(SCENE_ANALYSIS_PROMPT_VERSION).toBe("scene-analysis-v3");
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

describe("a creator's own segmentation", () => {
  const segments = [
    {
      number: 1,
      title: "Hook",
      timecodeLabel: "0:00 - 1:15",
      narration: "Hello world.",
      direction: "VISUAL: A calendar burns.",
    },
  ];

  it("is stated as fixed rather than as a suggestion", () => {
    const prompt = renderSceneAnalysisPrompt({ ...input, segments });
    expect(prompt).toContain("The creator already divided this script into 1");
    expect(prompt).toContain("Do not re-split, merge, reorder");
    expect(prompt).toContain("0:00 - 1:15");
    expect(prompt).toContain("VISUAL: A calendar burns.");
    expect(prompt).toContain("Never copy it into narrationText");
  });

  it("is absent when the creator gave none, leaving the original task", () => {
    const prompt = renderSceneAnalysisPrompt(input);
    expect(prompt).not.toContain("The creator already divided");
    expect(prompt).toContain("Convert the approved narration script");
  });

  it("is repeated on the repair attempt so a retry cannot re-segment", () => {
    const prompt = renderSceneAnalysisRepairPrompt({
      ...input,
      discrepancy: "Scene 1 skips 3 characters.",
      segments,
    });
    expect(prompt).toContain("The creator already divided this script into 1");
  });
});
