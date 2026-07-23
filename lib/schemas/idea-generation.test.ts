import { describe, expect, it } from "vitest";
import {
  generateIdeasSchema,
  ideaGenerationOutputSchema,
  saveIdeaSchema,
} from "@/lib/schemas/idea-generation";

const validIdea = {
  topic: "Why your budget keeps failing",
  targetAudience: "Broke college students",
  tone: "Encouraging",
  targetDurationSeconds: 45,
  primaryPlatform: "tiktok",
  hookAngle: "You are not bad with money — your method is",
  rationale: "Reframes shame into a fixable system.",
  hookType: "reframe",
};

describe("ideaGenerationOutputSchema", () => {
  it("parses a well-formed set of idea cards", () => {
    const parsed = ideaGenerationOutputSchema.parse({ ideas: [validIdea] });
    expect(parsed.ideas).toHaveLength(1);
    expect(parsed.ideas[0].primaryPlatform).toBe("tiktok");
  });

  it("allows a null duration", () => {
    const parsed = ideaGenerationOutputSchema.parse({
      ideas: [{ ...validIdea, targetDurationSeconds: null }],
    });
    expect(parsed.ideas[0].targetDurationSeconds).toBeNull();
  });

  it("rejects an empty idea set", () => {
    expect(() => ideaGenerationOutputSchema.parse({ ideas: [] })).toThrow();
  });

  it("rejects an unknown platform", () => {
    expect(() =>
      ideaGenerationOutputSchema.parse({
        ideas: [{ ...validIdea, primaryPlatform: "threads" }],
      }),
    ).toThrow();
  });
});

describe("generateIdeasSchema", () => {
  it("defaults the count and treats platform as optional", () => {
    const parsed = generateIdeasSchema.parse({
      niche: "home cooking",
      requestNonce: "nonce-1",
    });
    expect(parsed.count).toBe(5);
    expect(parsed.platform).toBeUndefined();
  });

  it("rejects a too-short niche", () => {
    expect(() =>
      generateIdeasSchema.parse({ niche: "x", requestNonce: "nonce-1" }),
    ).toThrow();
  });
});

describe("saveIdeaSchema", () => {
  it("requires a platform and fills blank text fields", () => {
    const parsed = saveIdeaSchema.parse({
      niche: "home cooking",
      primaryPlatform: "youtube",
    });
    expect(parsed.topic).toBe("");
    expect(parsed.primaryPlatform).toBe("youtube");
  });
});
