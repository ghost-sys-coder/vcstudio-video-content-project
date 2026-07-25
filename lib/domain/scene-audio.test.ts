import { describe, expect, it } from "vitest";
import {
  assertAiGeneratedSceneAudio,
  sceneAudioFormatForUploadContentType,
} from "@/lib/domain/scene-audio";
import type { SceneAudioGeneration } from "@/db/schema";

function generation(
  overrides: Partial<SceneAudioGeneration> = {},
): SceneAudioGeneration {
  return {
    id: "generation-id",
    workspaceId: "workspace-id",
    projectId: "project-id",
    sceneId: "scene-id",
    sceneVersionId: "scene-version-id",
    voicePresetId: "voice-preset-id",
    source: "ai_generated",
    generationVersion: 1,
    requestNonce: "request-nonce",
    status: "succeeded",
    reviewStatus: "pending",
    triggerRunId: null,
    idempotencyKey: "idempotency-key",
    requestFingerprint: "request-fingerprint",
    provider: "openai",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "mp3",
    speedScaledPercent: 100,
    instructions: "",
    sampleRate: null,
    inputText: "Hello world",
    inputCharacterCount: 11,
    estimatedCostCents: 5,
    actualCostCents: null,
    progressPercent: 100,
    attemptCount: 1,
    providerRequestId: null,
    assetObjectKey: null,
    assetContentType: null,
    assetSizeBytes: null,
    assetEtag: null,
    durationMilliseconds: null,
    errorCategory: null,
    safeErrorMessage: null,
    requestedByUserId: "user-id",
    reviewedByUserId: null,
    reviewedAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SceneAudioGeneration;
}

describe("sceneAudioFormatForUploadContentType", () => {
  it("maps audio/mp4 to m4a and everything else to webm", () => {
    expect(sceneAudioFormatForUploadContentType("audio/mp4")).toBe("m4a");
    expect(sceneAudioFormatForUploadContentType("audio/webm")).toBe("webm");
  });
});

describe("assertAiGeneratedSceneAudio", () => {
  it("does not throw for an ai_generated row", () => {
    expect(() =>
      assertAiGeneratedSceneAudio(generation({ source: "ai_generated" })),
    ).not.toThrow();
  });

  it("throws for a user_recorded row", () => {
    expect(() =>
      assertAiGeneratedSceneAudio(
        generation({
          source: "user_recorded",
          voicePresetId: null,
          provider: null,
          model: null,
          voice: null,
          speedScaledPercent: null,
          format: "webm",
        }),
      ),
    ).toThrow(/NOT_AI_GENERATED/);
  });
});
