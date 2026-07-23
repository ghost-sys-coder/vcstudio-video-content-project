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
  requireHistoricalAccuracy: false,
};

describe("script generation prompt", () => {
  it("pins the version and renders deterministically", () => {
    expect(SCRIPT_GENERATION_PROMPT_VERSION).toBe("script-generation-v2");
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

  it("omits the historical-accuracy directive by default", () => {
    expect(renderScriptGenerationPrompt(input)).not.toContain(
      "Historical accuracy is mandatory",
    );
  });

  it("adds a strict factual-accuracy directive for historical content", () => {
    const prompt = renderScriptGenerationPrompt({
      ...input,
      topic: "The rise and fall of the Roman Empire",
      requireHistoricalAccuracy: true,
    });
    expect(prompt).toContain(
      "Historical accuracy is mandatory for this script",
    );
    expect(prompt).toContain("Do not invent events, dates, quotes");
    expect(prompt).toContain("Never attribute invented or paraphrased words");
  });
});
