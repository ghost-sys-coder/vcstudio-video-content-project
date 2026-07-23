import { describe, expect, it } from "vitest";
import {
  IDEA_GENERATION_PROMPT_VERSION,
  renderIdeaGenerationPrompt,
} from "./idea-generation";

const base = {
  niche: "personal finance for students",
  count: 5,
  platform: null,
  tonePreference: null,
  language: "English",
  requireHistoricalAccuracy: false,
} as const;

describe("renderIdeaGenerationPrompt", () => {
  it("pins the prompt version so previous runs stay reproducible", () => {
    expect(IDEA_GENERATION_PROMPT_VERSION).toBe("idea-generation-v2");
  });

  it("includes the niche, count, and language", () => {
    const prompt = renderIdeaGenerationPrompt(base);
    expect(prompt).toContain("personal finance for students");
    expect(prompt).toContain("Produce 5 genuinely distinct video ideas");
    expect(prompt).toContain("English");
  });

  it("stays honest: never promises virality or claims live trends", () => {
    const prompt = renderIdeaGenerationPrompt(base).toLowerCase();
    expect(prompt).not.toContain('guaranteed to go viral"');
    expect(prompt).toContain("do not claim any idea is guaranteed to go viral");
    expect(prompt).toContain(
      'do not describe anything as "currently trending"',
    );
  });

  it("lets the model pick a platform per idea when none is fixed", () => {
    const prompt = renderIdeaGenerationPrompt(base);
    expect(prompt).toContain("choose the single best-fit platform");
  });

  it("locks every idea to a fixed platform when one is given", () => {
    const prompt = renderIdeaGenerationPrompt({ ...base, platform: "tiktok" });
    expect(prompt).toContain("Every idea must target TikTok");
    expect(prompt).toContain('Set primaryPlatform to "tiktok"');
  });

  it("includes an optional tone steer when provided", () => {
    const prompt = renderIdeaGenerationPrompt({
      ...base,
      tonePreference: "dry and witty",
    });
    expect(prompt).toContain("dry and witty");
  });

  it("omits the historical-accuracy directive by default", () => {
    const prompt = renderIdeaGenerationPrompt(base);
    expect(prompt).not.toContain("Historical accuracy is mandatory");
  });

  it("requires factual, verifiable premises when historical accuracy is on", () => {
    const prompt = renderIdeaGenerationPrompt({
      ...base,
      niche: "History in short stories",
      requireHistoricalAccuracy: true,
    });
    expect(prompt).toContain("Historical accuracy is mandatory for this niche");
    expect(prompt).toContain(
      "grounded in a real, verifiable historical event, figure, or record",
    );
    expect(prompt).toContain("Do not invent events");
  });
});
