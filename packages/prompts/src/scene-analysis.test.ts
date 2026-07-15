import { describe, expect, it } from "vitest";
import {
  renderSceneAnalysisPrompt,
  SCENE_ANALYSIS_PROMPT_VERSION,
} from "./scene-analysis";

describe("scene analysis prompt", () => {
  it("renders deterministically with a version", () => {
    const input = {
      script: "Hello world.",
      maximumScenes: 10,
      aspectRatio: "16:9",
      language: "en",
    };
    expect(renderSceneAnalysisPrompt(input)).toBe(
      renderSceneAnalysisPrompt(input),
    );
    expect(SCENE_ANALYSIS_PROMPT_VERSION).toBe("scene-analysis-v1");
    expect(renderSceneAnalysisPrompt(input)).toContain("Hello world.");
  });
});
