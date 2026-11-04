import { describe, expect, it } from "vitest";
import {
  operationalLimitsEnvironmentSchema,
  renderEnvironmentSchema,
  sceneAudioEnvironmentSchema,
  sceneImageEnvironmentSchema,
} from "./server-schema";

describe("provider-independent operational limits", () => {
  it("uses the existing defaults for unset and blank settings without provider credentials", () => {
    const expected = {
      MAX_IMAGES_PER_BATCH: 25,
      MAX_SCENES_PER_AUDIO_BATCH: 25,
      MAX_RENDER_DURATION_SECONDS: 900,
      MAX_RENDER_ATTEMPTS: 2,
    };
    expect(operationalLimitsEnvironmentSchema.parse({})).toEqual(expected);
    expect(
      operationalLimitsEnvironmentSchema.parse({
        MAX_IMAGES_PER_BATCH: "",
        MAX_SCENES_PER_AUDIO_BATCH: " ",
        MAX_RENDER_DURATION_SECONDS: "\t",
        MAX_RENDER_ATTEMPTS: "",
        OPENAI_TTS_MODEL: "",
        OPENAI_TTS_VOICE: "",
      }),
    ).toEqual(expected);
  });

  it("preserves configured limits, including zero retries", () => {
    expect(
      operationalLimitsEnvironmentSchema.parse({
        MAX_IMAGES_PER_BATCH: "4",
        MAX_SCENES_PER_AUDIO_BATCH: "3",
        MAX_RENDER_DURATION_SECONDS: "60",
        MAX_RENDER_ATTEMPTS: "0",
      }),
    ).toEqual({
      MAX_IMAGES_PER_BATCH: 4,
      MAX_SCENES_PER_AUDIO_BATCH: 3,
      MAX_RENDER_DURATION_SECONDS: 60,
      MAX_RENDER_ATTEMPTS: 0,
    });
  });

  it.each([
    ["MAX_IMAGES_PER_BATCH", "0"],
    ["MAX_IMAGES_PER_BATCH", "101"],
    ["MAX_SCENES_PER_AUDIO_BATCH", "0"],
    ["MAX_SCENES_PER_AUDIO_BATCH", "invalid"],
    ["MAX_RENDER_DURATION_SECONDS", "7201"],
    ["MAX_RENDER_ATTEMPTS", "-1"],
    ["MAX_RENDER_ATTEMPTS", "4"],
  ])("rejects invalid %s=%s instead of falling back", (key, value) => {
    expect(
      operationalLimitsEnvironmentSchema.safeParse({ [key]: value }).success,
    ).toBe(false);
  });

  it("shares exact limit validators with generation and rendering", () => {
    expect(sceneImageEnvironmentSchema.shape.MAX_IMAGES_PER_BATCH).toBe(
      operationalLimitsEnvironmentSchema.shape.MAX_IMAGES_PER_BATCH,
    );
    expect(sceneAudioEnvironmentSchema.shape.MAX_SCENES_PER_AUDIO_BATCH).toBe(
      operationalLimitsEnvironmentSchema.shape.MAX_SCENES_PER_AUDIO_BATCH,
    );
    expect(renderEnvironmentSchema.shape.MAX_RENDER_DURATION_SECONDS).toBe(
      operationalLimitsEnvironmentSchema.shape.MAX_RENDER_DURATION_SECONDS,
    );
    expect(renderEnvironmentSchema.shape.MAX_RENDER_ATTEMPTS).toBe(
      operationalLimitsEnvironmentSchema.shape.MAX_RENDER_ATTEMPTS,
    );
    expect(sceneImageEnvironmentSchema.safeParse({}).success).toBe(false);
    expect(sceneAudioEnvironmentSchema.safeParse({}).success).toBe(false);
    expect(renderEnvironmentSchema.safeParse({}).success).toBe(false);
  });
});
