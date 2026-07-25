import { describe, expect, it } from "vitest";
import {
  completeSceneAudioRecordingUploadSchema,
  createSceneAudioRecordingUploadSchema,
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

describe("scene audio recording upload schemas", () => {
  const config = {
    allowedTypes: ["audio/webm", "audio/mp4"],
    maximumBytes: 15 * 1024 * 1024,
  };
  const ids = {
    sceneId: "00000000-0000-4000-8000-000000000002",
    sceneVersionId: "00000000-0000-4000-8000-000000000003",
    generationId: "00000000-0000-4000-8000-000000000006",
  };

  it("accepts a well-formed recording upload authorization request", () => {
    expect(
      createSceneAudioRecordingUploadSchema(config).safeParse({
        ...ids,
        contentType: "audio/webm",
        fileName: "recording.webm",
        sizeBytes: 1024,
      }).success,
    ).toBe(true);
  });

  it("rejects a content type outside the allowlist", () => {
    const restricted = createSceneAudioRecordingUploadSchema({
      ...config,
      allowedTypes: ["audio/webm"],
    });
    expect(
      restricted.safeParse({
        ...ids,
        contentType: "audio/mp4",
        fileName: "recording.m4a",
        sizeBytes: 1024,
      }).success,
    ).toBe(false);
  });

  it("rejects a file over the maximum size", () => {
    expect(
      createSceneAudioRecordingUploadSchema(config).safeParse({
        ...ids,
        contentType: "audio/webm",
        fileName: "recording.webm",
        sizeBytes: config.maximumBytes + 1,
      }).success,
    ).toBe(false);
  });

  it("requires objectKey, generationId, and a bounded duration to complete", () => {
    const schema = completeSceneAudioRecordingUploadSchema(config);
    expect(
      schema.safeParse({
        ...ids,
        contentType: "audio/webm",
        sizeBytes: 1024,
        objectKey: "workspaces/w/projects/p/scenes/s/audio/g.webm",
        durationMilliseconds: 5_000,
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ...ids,
        contentType: "audio/webm",
        sizeBytes: 1024,
        objectKey: "workspaces/w/projects/p/scenes/s/audio/g.webm",
        durationMilliseconds: 31 * 60 * 1000,
      }).success,
    ).toBe(false);
  });
});
