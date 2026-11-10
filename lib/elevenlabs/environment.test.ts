import { describe, expect, it } from "vitest";
import {
  elevenLabsEnvironmentSchema,
  elevenLabsUnavailableReason,
} from "./environment";
const ready = {
  ENABLE_ELEVENLABS: "true",
  ELEVEN_LABS_API_KEY: "fake-key",
  ELEVENLABS_INTERNAL_DEPLOYMENT: "true",
};
describe("ElevenLabs deployment and licensing boundary", () => {
  it("is disabled by default and accepts an empty example key", () => {
    const env = elevenLabsEnvironmentSchema.parse({ ELEVEN_LABS_API_KEY: "" });
    expect(env.ENABLE_ELEVENLABS).toBe(false);
    expect(elevenLabsUnavailableReason(env)).toMatch(/switched off/);
  });
  it("requires a key and an explicit internal deployment assertion", () => {
    expect(
      elevenLabsUnavailableReason(
        elevenLabsEnvironmentSchema.parse({
          ...ready,
          ELEVEN_LABS_API_KEY: undefined,
        }),
      ),
    ).toMatch(/key/);
    expect(
      elevenLabsUnavailableReason(
        elevenLabsEnvironmentSchema.parse({
          ...ready,
          ELEVENLABS_INTERNAL_DEPLOYMENT: "false",
        }),
      ),
    ).toMatch(/in-house/);
  });
  it("fails closed when web private access is removed", () => {
    expect(
      elevenLabsUnavailableReason(
        elevenLabsEnvironmentSchema.parse({
          ...ready,
          ENABLE_PRIVATE_ACCESS: "false",
        }),
      ),
    ).toMatch(/in-house/);
  });
  it("requires commercial service licensing separately from a working key", () => {
    expect(
      elevenLabsUnavailableReason(
        elevenLabsEnvironmentSchema.parse({
          ...ready,
          ELEVENLABS_USAGE_MODE: "commercial",
        }),
      ),
    ).toMatch(/licensing review/);
    expect(
      elevenLabsUnavailableReason(
        elevenLabsEnvironmentSchema.parse({
          ...ready,
          ELEVENLABS_USAGE_MODE: "commercial",
          ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED: "true",
        }),
      ),
    ).toBeNull();
  });
  it("keeps voices eligible while visuals require explicit access", () => {
    const env = elevenLabsEnvironmentSchema.parse(ready);
    expect(elevenLabsUnavailableReason(env)).toBeNull();
    expect(elevenLabsUnavailableReason(env, true)).toMatch(/Pro/);
  });
  it("rejects invalid switches, pricing and unsupported speech models", () => {
    for (const bad of [
      { ENABLE_ELEVENLABS: "yes" },
      { ELEVENLABS_TTS_MODEL: "invented" },
      { ELEVENLABS_IMAGE_PRICING_JSON: "not-json" },
      { ELEVENLABS_TTS_COST_PER_MILLION_CHARACTERS_CENTS: -1 },
    ])
      expect(elevenLabsEnvironmentSchema.safeParse(bad).success).toBe(false);
  });
});
