import { describe, expect, it } from "vitest";
import { createSceneClipIdempotencyKey } from "@/lib/domain/idempotency";

const base = {
  secret: "test-secret",
  workspaceId: "11111111-1111-1111-1111-111111111111",
  projectId: "22222222-2222-2222-2222-222222222222",
  sceneVersionId: "33333333-3333-3333-3333-333333333333",
  promptTemplateVersion: "scene-motion-v1",
  generationVersion: 1,
  provider: "openai",
  model: "sora-2",
  mode: "image_to_video",
  aspectRatio: "16:9",
  durationSeconds: 8,
  resolutionHeight: 720,
  sourceImageGenerationId: "44444444-4444-4444-4444-444444444444",
};

function key(overrides: Partial<typeof base> = {}) {
  return createSceneClipIdempotencyKey({ ...base, ...overrides });
}

describe("the key that stops one clip being paid for twice", () => {
  it("is stable for the same request", () => {
    expect(key()).toBe(key());
  });

  it("changes when anything the provider would notice changes", () => {
    // Each of these produces different footage, so each must be able to be
    // bought separately rather than resolving to the first one's result.
    const original = key();
    expect(key({ model: "sora-2-pro" })).not.toBe(original);
    expect(key({ durationSeconds: 4 })).not.toBe(original);
    expect(key({ aspectRatio: "9:16" })).not.toBe(original);
    expect(key({ resolutionHeight: 480 })).not.toBe(original);
    expect(key({ mode: "text_to_video" })).not.toBe(original);
    expect(key({ promptTemplateVersion: "scene-motion-v2" })).not.toBe(
      original,
    );
    expect(key({ provider: "replicate" })).not.toBe(original);
  });

  it("changes when the still being animated changes", () => {
    // Animating a replacement image is a different clip, however identical the
    // instruction is.
    expect(
      key({ sourceImageGenerationId: "55555555-5555-5555-5555-555555555555" }),
    ).not.toBe(key());
  });

  it("lets a deliberate new take be bought", () => {
    // Asking again for the same scene is a new generation version, and must not
    // quietly resolve to the earlier clip.
    expect(key({ generationVersion: 2 })).not.toBe(key());
  });

  it("keeps two workspaces and two scenes apart", () => {
    expect(
      key({ workspaceId: "99999999-9999-9999-9999-999999999999" }),
    ).not.toBe(key());
    expect(
      key({ sceneVersionId: "88888888-8888-8888-8888-888888888888" }),
    ).not.toBe(key());
  });

  it("depends on the secret, so keys cannot be forged from public values", () => {
    expect(key({ secret: "other-secret" })).not.toBe(key());
  });

  it("refuses a generation version that is not a positive whole number", () => {
    expect(() => key({ generationVersion: 0 })).toThrow(RangeError);
    expect(() => key({ generationVersion: 1.5 })).toThrow(RangeError);
  });

  it("distinguishes a clip with no source still from one with a still", () => {
    expect(
      key({ mode: "text_to_video", sourceImageGenerationId: null }),
    ).not.toBe(key({ mode: "text_to_video" }));
  });
});
