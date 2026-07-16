import { describe, expect, it } from "vitest";
import {
  createSceneAnalysisIdempotencyKey,
  createSceneAnalysisRetryIdempotencyKey,
  createSceneImageIdempotencyKey,
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
