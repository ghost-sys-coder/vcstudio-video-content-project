import { describe, it, expect } from "vitest";
import {
  videoEnvironmentSchema,
  videoProviderConfigured,
} from "./video-environment";
describe("video runtime configuration", () => {
  it("defaults to disabled, optional providers and conservative independent limits", () => {
    expect(videoEnvironmentSchema.parse({})).toMatchObject({
      ENABLE_VIDEO_GENERATION: false,
      VIDEO_GENERATION_MAX_COST_CENTS: 150,
      VIDEO_GENERATION_DAILY_BUDGET_CENTS: 300,
      VIDEO_GENERATION_LIFETIME_BUDGET_CENTS: 1500,
      VIDEO_GENERATION_PRICING_JSON: [],
    });
  });
  it("treats blank optional keys as unconfigured and trims actual keys", () => {
    const environment = videoEnvironmentSchema.parse({
      GOOGLE_AI_VIDEO_GENERATION_API_KEY: "  key  ",
      RUNWAYML_API_SECRET: " ",
    });
    expect(videoProviderConfigured("google_gemini", environment)).toBe(true);
    expect(environment.GOOGLE_AI_VIDEO_GENERATION_API_KEY).toBe("key");
    expect(videoProviderConfigured("runway", environment)).toBe(false);
  });
  it("rejects invalid spending limits and malformed or unvalidated pricing JSON", () => {
    for (const input of [
      { VIDEO_GENERATION_MAX_COST_CENTS: 0 },
      { VIDEO_GENERATION_DAILY_BUDGET_CENTS: -1 },
      { VIDEO_GENERATION_LIFETIME_BUDGET_CENTS: "unlimited" },
      { VIDEO_GENERATION_PRICING_JSON: "not-json" },
      { VIDEO_GENERATION_PRICING_JSON: '[{"arbitrary":"configuration"}]' },
    ])
      expect(videoEnvironmentSchema.safeParse(input).success).toBe(false);
  });
});
