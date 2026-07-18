import { describe, expect, it } from "vitest";
import { createVideoRenderIdempotencyKey } from "@/lib/domain/idempotency";

const BASE = {
  secret: "test-secret-value-that-is-long-enough-000",
  workspaceId: "ws-1",
  projectId: "proj-1",
  preset: "landscape_1080p",
  width: 1920,
  height: 1080,
  framesPerSecond: 30,
  includeCaptions: true,
  includeWatermark: false,
  timelineFingerprint: "abc123",
};

describe("createVideoRenderIdempotencyKey", () => {
  it("is deterministic for identical inputs", () => {
    expect(createVideoRenderIdempotencyKey(BASE)).toBe(
      createVideoRenderIdempotencyKey(BASE),
    );
  });

  it("changes when the timeline fingerprint changes", () => {
    expect(createVideoRenderIdempotencyKey(BASE)).not.toBe(
      createVideoRenderIdempotencyKey({
        ...BASE,
        timelineFingerprint: "different",
      }),
    );
  });

  it("changes when the preset or geometry changes", () => {
    expect(createVideoRenderIdempotencyKey(BASE)).not.toBe(
      createVideoRenderIdempotencyKey({ ...BASE, preset: "vertical_1080p" }),
    );
    expect(createVideoRenderIdempotencyKey(BASE)).not.toBe(
      createVideoRenderIdempotencyKey({ ...BASE, width: 1080 }),
    );
  });

  it("changes when caption or watermark inclusion changes", () => {
    expect(createVideoRenderIdempotencyKey(BASE)).not.toBe(
      createVideoRenderIdempotencyKey({ ...BASE, includeCaptions: false }),
    );
    expect(createVideoRenderIdempotencyKey(BASE)).not.toBe(
      createVideoRenderIdempotencyKey({ ...BASE, includeWatermark: true }),
    );
  });

  it("scopes the key to the workspace and project", () => {
    expect(createVideoRenderIdempotencyKey(BASE)).not.toBe(
      createVideoRenderIdempotencyKey({ ...BASE, workspaceId: "ws-2" }),
    );
  });
});
