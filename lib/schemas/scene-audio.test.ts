import { describe, expect, it } from "vitest";
import {
  startBulkSceneAudioGenerationSchema,
  voicePresetInputSchema,
} from "@/lib/schemas/scene-audio";

describe("voicePresetInputSchema", () => {
  it("accepts a valid preset and applies defaults", () => {
    const parsed = voicePresetInputSchema.safeParse({
      name: "Narrator",
      voice: "alloy",
      model: "gpt-4o-mini-tts",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.speedScaledPercent).toBe(100);
      expect(parsed.data.format).toBe("mp3");
      expect(parsed.data.instructions).toBe("");
    }
  });

  it("rejects an empty voice", () => {
    expect(
      voicePresetInputSchema.safeParse({
        name: "Narrator",
        voice: "",
        model: "gpt-4o-mini-tts",
      }).success,
    ).toBe(false);
  });

  it("rejects an out-of-range speed", () => {
    expect(
      voicePresetInputSchema.safeParse({
        name: "Narrator",
        voice: "alloy",
        model: "gpt-4o-mini-tts",
        speedScaledPercent: 500,
      }).success,
    ).toBe(false);
  });

  it("rejects an unsupported format", () => {
    expect(
      voicePresetInputSchema.safeParse({
        name: "Narrator",
        voice: "alloy",
        model: "gpt-4o-mini-tts",
        format: "ogg",
      }).success,
    ).toBe(false);
  });
});

describe("startBulkSceneAudioGenerationSchema", () => {
  it("rejects duplicate scene ids", () => {
    const id = "44444444-4444-4444-8444-444444444444";
    expect(
      startBulkSceneAudioGenerationSchema.safeParse({
        projectId: "11111111-1111-4111-8111-111111111111",
        voicePresetId: "22222222-2222-4222-8222-222222222222",
        requestNonce: "33333333-3333-4333-8333-333333333333",
        sceneIds: [id, id],
      }).success,
    ).toBe(false);
  });
});
