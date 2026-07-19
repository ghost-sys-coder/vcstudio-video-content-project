import { describe, expect, it } from "vitest";
import {
  renderScriptGenerationPrompt,
  SCRIPT_GENERATION_PROMPT_VERSION,
  type ScriptGenerationPromptInput,
} from "./script-generation";

const input: ScriptGenerationPromptInput = {
  topic: "Why most people fail at saving money",
  targetAudience: "beginners to personal finance",
  tone: "energetic and direct",
  targetDurationSeconds: 60,
  primaryPlatform: "youtube",
  hookAngle: "open with a surprising statistic",
  language: "English",
};

describe("script generation prompt", () => {
  it("pins the version and renders deterministically", () => {
    expect(SCRIPT_GENERATION_PROMPT_VERSION).toBe("script-generation-v1");
    expect(renderScriptGenerationPrompt(input)).toBe(
      renderScriptGenerationPrompt(input),
    );
  });

  it("includes the brief, platform guidance, and narration-only rule", () => {
    const prompt = renderScriptGenerationPrompt(input);
    expect(prompt).toContain("Why most people fail at saving money");
    expect(prompt).toContain("beginners to personal finance");
    expect(prompt).toContain("open with a surprising statistic");
    expect(prompt).toContain("YouTube");
    expect(prompt).toContain("NARRATION ONLY");
    expect(prompt).toContain("~150 words");
  });

  it("varies platform guidance and omits length when duration is absent", () => {
    const tiktok = renderScriptGenerationPrompt({
      ...input,
      primaryPlatform: "tiktok",
      targetDurationSeconds: null,
    });
    expect(tiktok).toContain("TikTok");
    expect(tiktok).not.toContain("Target about");
  });
});
