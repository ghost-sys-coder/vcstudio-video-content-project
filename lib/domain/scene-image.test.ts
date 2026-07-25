import { describe, expect, it } from "vitest";
import {
  assertAiGeneratedSceneImage,
  isSceneImageUploadAspectRatioAllowed,
  sceneImageOutputFormatForUploadContentType,
} from "@/lib/domain/scene-image";
import type { SceneImageGeneration } from "@/db/schema";

function generation(
  overrides: Partial<SceneImageGeneration> = {},
): SceneImageGeneration {
  return {
    id: "generation-id",
    workspaceId: "workspace-id",
    projectId: "project-id",
    sceneId: "scene-id",
    sceneVersionId: "scene-version-id",
    purpose: "scene",
    source: "ai_generated",
    outputVariantId: null,
    sourceImageGenerationId: null,
    stylePresetVersionId: "style-preset-version-id",
    promptTemplateVersionId: "prompt-template-version-id",
    generationVersion: 1,
    requestNonce: "request-nonce",
    status: "succeeded",
    reviewStatus: "pending",
    batchId: null,
    triggerRunId: null,
    idempotencyKey: "idempotency-key",
    requestFingerprint: "request-fingerprint",
    model: "gpt-image-2",
    quality: "medium",
    size: "1536x1024",
    outputFormat: "webp",
    outputCompression: 90,
    background: "opaque",
    inputFidelity: null,
    promptTemplateVersion: "1",
    stylePresetVersion: 1,
    finalPrompt: "a scene",
    estimatedCostCents: 10,
    actualCostCents: null,
    progressPercent: 100,
    attemptCount: 1,
    assetObjectKey: null,
    assetContentType: null,
    assetSizeBytes: null,
    assetWidth: null,
    assetHeight: null,
    assetEtag: null,
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
  } as SceneImageGeneration;
}

describe("sceneImageOutputFormatForUploadContentType", () => {
  it("maps each allowed content type to its output format", () => {
    expect(sceneImageOutputFormatForUploadContentType("image/png")).toBe("png");
    expect(sceneImageOutputFormatForUploadContentType("image/jpeg")).toBe(
      "jpeg",
    );
    expect(sceneImageOutputFormatForUploadContentType("image/webp")).toBe(
      "webp",
    );
  });
});

describe("isSceneImageUploadAspectRatioAllowed", () => {
  it("accepts an exact match for each supported size", () => {
    expect(
      isSceneImageUploadAspectRatioAllowed({
        width: 1536,
        height: 1024,
        targetSize: "1536x1024",
      }),
    ).toBe(true);
    expect(
      isSceneImageUploadAspectRatioAllowed({
        width: 1024,
        height: 1536,
        targetSize: "1024x1536",
      }),
    ).toBe(true);
    expect(
      isSceneImageUploadAspectRatioAllowed({
        width: 2048,
        height: 2048,
        targetSize: "1024x1024",
      }),
    ).toBe(true);
  });

  it("accepts a close match within tolerance", () => {
    // 1500x1000 is aspect ratio 1.5 vs target 1536x1024's 1.5 -- exact.
    // 1400x1000 is aspect ratio 1.4, ~6.7% off 1.5 -- within the 10% default.
    expect(
      isSceneImageUploadAspectRatioAllowed({
        width: 1400,
        height: 1000,
        targetSize: "1536x1024",
      }),
    ).toBe(true);
  });

  it("rejects a badly mismatched aspect ratio", () => {
    expect(
      isSceneImageUploadAspectRatioAllowed({
        width: 1024,
        height: 1024,
        targetSize: "1536x1024",
      }),
    ).toBe(false);
    expect(
      isSceneImageUploadAspectRatioAllowed({
        width: 1536,
        height: 1024,
        targetSize: "1024x1536",
      }),
    ).toBe(false);
  });

  it("rejects non-positive dimensions", () => {
    expect(
      isSceneImageUploadAspectRatioAllowed({
        width: 0,
        height: 1024,
        targetSize: "1536x1024",
      }),
    ).toBe(false);
  });

  it("respects a custom tolerance", () => {
    expect(
      isSceneImageUploadAspectRatioAllowed({
        width: 1400,
        height: 1000,
        targetSize: "1536x1024",
        toleranceRatio: 0.01,
      }),
    ).toBe(false);
  });
});

describe("assertAiGeneratedSceneImage", () => {
  it("does not throw for an ai_generated row", () => {
    expect(() =>
      assertAiGeneratedSceneImage(generation({ source: "ai_generated" })),
    ).not.toThrow();
  });

  it("throws for a user_uploaded row", () => {
    expect(() =>
      assertAiGeneratedSceneImage(
        generation({
          source: "user_uploaded",
          model: null,
          quality: null,
          stylePresetVersionId: null,
        }),
      ),
    ).toThrow(/NOT_AI_GENERATED/);
  });
});
