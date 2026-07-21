import { describe, expect, it } from "vitest";
import {
  createSceneAnalysisIdempotencyKey,
  createSceneAnalysisRetryIdempotencyKey,
  createSceneImageIdempotencyKey,
  createThumbnailGenerationIdempotencyKey,
  createTitleGenerationIdempotencyKey,
} from "@/lib/domain/idempotency";

describe("createSceneAnalysisIdempotencyKey", () => {
  it("is deterministic and changes with the script version", () => {
    const input = {
      secret: "s".repeat(32),
      workspaceId: "w",
      projectId: "p",
      scriptVersionId: "v1",
      model: "m",
      promptVersion: "pv",
    };
    const first = createSceneAnalysisIdempotencyKey(input);
    expect(createSceneAnalysisIdempotencyKey(input)).toBe(first);
    expect(
      createSceneAnalysisIdempotencyKey({ ...input, scriptVersionId: "v2" }),
    ).not.toBe(first);
  });

  it("creates a deterministic retry key from the failed run", () => {
    const input = { secret: "s".repeat(32), failedRunId: "run-1" };
    const first = createSceneAnalysisRetryIdempotencyKey(input);
    expect(createSceneAnalysisRetryIdempotencyKey(input)).toBe(first);
    expect(
      createSceneAnalysisRetryIdempotencyKey({
        ...input,
        failedRunId: "run-2",
      }),
    ).not.toBe(first);
  });
});

describe("createSceneImageIdempotencyKey", () => {
  const input = {
    secret: "s".repeat(32),
    workspaceId: "workspace-1",
    projectId: "project-1",
    sceneVersionId: "scene-version-1",
    promptTemplateVersion: "scene-image-v1",
    stylePresetVersion: "style-version-1",
    generationVersion: 1,
    model: "gpt-image-2",
    quality: "low",
    size: "1536x1024",
    outputFormat: "webp",
    outputCompression: 80,
    background: "opaque",
    referenceAssetIds: ["reference-b", "reference-a"],
  };

  it("is stable regardless of reference selection order", () => {
    const first = createSceneImageIdempotencyKey(input);
    expect(
      createSceneImageIdempotencyKey({
        ...input,
        referenceAssetIds: ["reference-a", "reference-b"],
      }),
    ).toBe(first);
  });

  it("changes for every explicit generation version", () => {
    expect(
      createSceneImageIdempotencyKey({ ...input, generationVersion: 2 }),
    ).not.toBe(createSceneImageIdempotencyKey(input));
  });

  it("changes when any billable generation setting changes", () => {
    const first = createSceneImageIdempotencyKey(input);
    expect(
      createSceneImageIdempotencyKey({ ...input, quality: "medium" }),
    ).not.toBe(first);
    expect(
      createSceneImageIdempotencyKey({ ...input, outputCompression: 90 }),
    ).not.toBe(first);
    expect(
      createSceneImageIdempotencyKey({ ...input, background: "auto" }),
    ).not.toBe(first);
    expect(
      createSceneImageIdempotencyKey({
        ...input,
        referenceAssetIds: ["reference-a"],
      }),
    ).not.toBe(first);
  });
});

describe("createTitleGenerationIdempotencyKey", () => {
  const input = {
    secret: "s".repeat(32),
    workspaceId: "workspace-1",
    projectId: "project-1",
    platform: "youtube",
    briefFingerprint: "fingerprint-1",
    model: "gpt-5",
    promptVersion: "title-generation-v1",
    requestNonce: "nonce-1",
  };

  it("is deterministic for the same inputs", () => {
    expect(createTitleGenerationIdempotencyKey(input)).toBe(
      createTitleGenerationIdempotencyKey(input),
    );
  });

  it("differs per platform so each platform is a distinct run", () => {
    expect(
      createTitleGenerationIdempotencyKey({ ...input, platform: "tiktok" }),
    ).not.toBe(createTitleGenerationIdempotencyKey(input));
  });

  it("changes with the brief fingerprint and the request nonce", () => {
    const first = createTitleGenerationIdempotencyKey(input);
    expect(
      createTitleGenerationIdempotencyKey({
        ...input,
        briefFingerprint: "fingerprint-2",
      }),
    ).not.toBe(first);
    expect(
      createTitleGenerationIdempotencyKey({
        ...input,
        requestNonce: "nonce-2",
      }),
    ).not.toBe(first);
  });
});

describe("createThumbnailGenerationIdempotencyKey", () => {
  const input = {
    secret: "s".repeat(32),
    workspaceId: "workspace-1",
    projectId: "project-1",
    platform: "youtube",
    textMode: "clean",
    headlineText: "",
    briefFingerprint: "fingerprint-1",
    model: "gpt-image-2",
    quality: "medium",
    size: "1536x1024",
    promptVersion: "thumbnail-v1",
    requestNonce: "nonce-1",
  };

  it("is deterministic for the same inputs", () => {
    expect(createThumbnailGenerationIdempotencyKey(input)).toBe(
      createThumbnailGenerationIdempotencyKey(input),
    );
  });

  it("differs per platform so each platform is a distinct image", () => {
    expect(
      createThumbnailGenerationIdempotencyKey({
        ...input,
        platform: "tiktok",
      }),
    ).not.toBe(createThumbnailGenerationIdempotencyKey(input));
  });

  it("changes with the text mode and headline", () => {
    const first = createThumbnailGenerationIdempotencyKey(input);
    const baked = createThumbnailGenerationIdempotencyKey({
      ...input,
      textMode: "baked",
      headlineText: "IT WAS RUSTING",
    });
    expect(baked).not.toBe(first);
    expect(
      createThumbnailGenerationIdempotencyKey({
        ...input,
        textMode: "baked",
        headlineText: "IT WAS FINE",
      }),
    ).not.toBe(baked);
  });

  it("changes with quality, size, and the request nonce", () => {
    const first = createThumbnailGenerationIdempotencyKey(input);
    expect(
      createThumbnailGenerationIdempotencyKey({ ...input, quality: "high" }),
    ).not.toBe(first);
    expect(
      createThumbnailGenerationIdempotencyKey({
        ...input,
        size: "1024x1536",
      }),
    ).not.toBe(first);
    expect(
      createThumbnailGenerationIdempotencyKey({
        ...input,
        requestNonce: "nonce-2",
      }),
    ).not.toBe(first);
  });
});
