import { describe, expect, it } from "vitest";
import {
  assertAiGeneratedSceneImage,
  describeSceneImageAspectMismatch,
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

/**
 * The ratios people actually upload, pinned by name.
 *
 * The previous ten per cent limit rejected a plain 16:9 screenshot and an
 * ordinary 4:3 photo, which is what made the guard feel broken. These cases
 * state which shapes are meant to get in and which are still meant to be
 * turned away, so a future adjustment has to decide about real files rather
 * than an abstract percentage.
 */
describe("the shapes a creator actually has", () => {
  const allowed = (
    width: number,
    height: number,
    targetSize: Parameters<
      typeof isSceneImageUploadAspectRatioAllowed
    >[0]["targetSize"],
  ) => isSceneImageUploadAspectRatioAllowed({ width, height, targetSize });

  it("accepts a widescreen screenshot into the landscape slot", () => {
    expect(allowed(1920, 1080, "1536x1024")).toBe(true);
  });

  it("accepts an ordinary photo into the landscape slot", () => {
    expect(allowed(1600, 1200, "1536x1024")).toBe(true);
  });

  it("accepts a phone-shaped frame into the portrait slot", () => {
    expect(allowed(1080, 1920, "1024x1536")).toBe(true);
  });

  it("accepts a portrait photo into the portrait slot", () => {
    expect(allowed(1200, 1600, "1024x1536")).toBe(true);
  });

  // Still refused, because these are the wrong shape rather than slightly off,
  // and centre-cropping them would throw away most of the picture.
  it("refuses a widescreen frame in a square slot", () => {
    expect(allowed(1920, 1080, "1024x1024")).toBe(false);
  });

  it("refuses an ultrawide frame in the landscape slot", () => {
    expect(allowed(2560, 1080, "1536x1024")).toBe(false);
  });

  it("refuses a landscape photo in a square slot", () => {
    expect(allowed(1600, 1200, "1024x1024")).toBe(false);
  });

  it("still refuses an orientation flip", () => {
    expect(allowed(1920, 1080, "1024x1536")).toBe(false);
    expect(allowed(1080, 1920, "1536x1024")).toBe(false);
  });
});

describe("describeSceneImageAspectMismatch", () => {
  it("gives the numbers rather than a verdict", () => {
    const message = describeSceneImageAspectMismatch({
      width: 1920,
      height: 1080,
      targetSize: "1024x1024",
    });
    expect(message).toContain("1920×1080");
    expect(message).toContain("78% off");
    expect(message).toContain("limit is 20%");
  });

  it("says which way to crop for an image that is too wide", () => {
    expect(
      describeSceneImageAspectMismatch({
        width: 2560,
        height: 1080,
        targetSize: "1536x1024",
      }),
    ).toContain("Crop some width off");
  });

  it("says which way to crop for an image that is too tall", () => {
    expect(
      describeSceneImageAspectMismatch({
        width: 1080,
        height: 2560,
        targetSize: "1024x1536",
      }),
    ).toContain("Crop some height off");
  });

  it("does not pretend to measure a file it could not read", () => {
    expect(
      describeSceneImageAspectMismatch({
        width: 0,
        height: 0,
        targetSize: "1024x1024",
      }),
    ).toContain("could not be read");
  });
});
