import { describe, expect, it } from "vitest";
import {
  renderTitleGenerationPrompt,
  TITLE_GENERATION_PROMPT_VERSION,
  type TitleGenerationPromptInput,
} from "./title-generation";

const input: TitleGenerationPromptInput = {
  platform: "youtube",
  topic: "Why most people stay broke",
  targetAudience: "young professionals",
  tone: "direct and motivating",
  hookAngle: "challenge a common belief",
  script: null,
  language: "English",
  optionCount: 5,
};

describe("title generation prompt", () => {
  it("pins the version and renders deterministically", () => {
    expect(TITLE_GENERATION_PROMPT_VERSION).toBe("title-generation-v1");
    expect(renderTitleGenerationPrompt(input)).toBe(
      renderTitleGenerationPrompt(input),
    );
  });

  it("includes the brief, platform guidance, count, and honesty rule", () => {
    const prompt = renderTitleGenerationPrompt(input);
    expect(prompt).toContain("Why most people stay broke");
    expect(prompt).toContain("young professionals");
    expect(prompt).toContain("challenge a common belief");
    expect(prompt).toContain("YouTube");
    expect(prompt).toContain("5 distinct");
    expect(prompt).toContain("no bait the video cannot pay off");
  });

  it("varies guidance and hook types per platform", () => {
    const tiktok = renderTitleGenerationPrompt({
      ...input,
      platform: "tiktok",
    });
    expect(tiktok).toContain("TikTok");
    expect(tiktok).toContain("scroll");
    const facebook = renderTitleGenerationPrompt({
      ...input,
      platform: "facebook",
    });
    expect(facebook).toContain("Facebook");
  });

  it("bounds the script context excerpt", () => {
    const longScript = "word ".repeat(2000);
    const withScript = renderTitleGenerationPrompt({
      ...input,
      script: longScript,
    });
    expect(withScript).toContain("Approved script");
    expect(withScript).toContain("…");
    expect(withScript.length).toBeLessThan(longScript.length + 2000);
  });

  it("notes when no script is available", () => {
    expect(renderTitleGenerationPrompt(input)).toContain(
      "No finished script is available",
    );
  });
});
