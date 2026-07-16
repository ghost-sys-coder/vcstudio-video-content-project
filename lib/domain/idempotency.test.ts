import { describe, expect, it } from "vitest";
import {
  createSceneAnalysisIdempotencyKey,
  createSceneAnalysisRetryIdempotencyKey,
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
