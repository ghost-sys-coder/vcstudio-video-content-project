import { describe, expect, it } from "vitest";
import {
  planReframe,
  type ReframeSceneInput,
} from "@/lib/reframe/reframe-plan";

function scene(overrides: Partial<ReframeSceneInput> = {}): ReframeSceneInput {
  return {
    sceneId: "scene-1",
    sceneNumber: 1,
    sceneVersionId: "version-1",
    approvedImage: { generationId: "image-1", source: "ai_generated" },
    hasNativeImage: false,
    existingVariantImage: null,
    ...overrides,
  };
}

describe("what each scene needs", () => {
  it("extends an AI-generated still, which is the paid case", () => {
    const plan = planReframe([scene()]);
    expect(plan.scenes[0]?.action).toBe("extend");
    expect(plan.scenes[0]?.sourceGenerationId).toBe("image-1");
    expect(plan.extendCount).toBe(1);
  });

  it("leaves a scene alone when it already has a still in the target shape", () => {
    const plan = planReframe([scene({ hasNativeImage: true })]);
    expect(plan.scenes[0]?.action).toBe("native");
    expect(plan.extendCount).toBe(0);
    expect(plan.readyCount).toBe(1);
  });

  it("crops an uploaded still rather than refusing the whole job", () => {
    // An upload has no prompt to extend from. Cropping it is lossy but it is a
    // finished video, and the reason is carried so nothing is silent.
    const plan = planReframe([
      scene({
        approvedImage: { generationId: "image-1", source: "user_uploaded" },
      }),
    ]);
    expect(plan.scenes[0]?.action).toBe("crop");
    expect(plan.scenes[0]?.reason).toContain("uploaded");
    expect(plan.cropCount).toBe(1);
  });

  it("blocks a scene with nothing approved", () => {
    const plan = planReframe([scene({ approvedImage: null })]);
    expect(plan.scenes[0]?.action).toBe("blocked");
    expect(plan.blockedCount).toBe(1);
  });
});

describe("reusing what an earlier run already paid for", () => {
  it("reuses an extension made from the still that is approved now", () => {
    const plan = planReframe([
      scene({
        existingVariantImage: {
          generationId: "variant-1",
          sourceImageGenerationId: "image-1",
          status: "succeeded",
        },
      }),
    ]);
    expect(plan.scenes[0]?.action).toBe("reuse");
    expect(plan.extendCount).toBe(0);
  });

  it("pays again when the extension came from a still since replaced", () => {
    // Reusing it would render the old picture, which is worse than the cost.
    const plan = planReframe([
      scene({
        approvedImage: { generationId: "image-2", source: "ai_generated" },
        existingVariantImage: {
          generationId: "variant-1",
          sourceImageGenerationId: "image-1",
          status: "succeeded",
        },
      }),
    ]);
    expect(plan.scenes[0]?.action).toBe("extend");
  });

  it("pays again when the earlier extension failed", () => {
    const plan = planReframe([
      scene({
        existingVariantImage: {
          generationId: "variant-1",
          sourceImageGenerationId: "image-1",
          status: "failed",
        },
      }),
    ]);
    expect(plan.scenes[0]?.action).toBe("extend");
  });

  it("does not count an unfinished extension as done", () => {
    // Treating a running generation as ready would render before it lands.
    const plan = planReframe([
      scene({
        existingVariantImage: {
          generationId: "variant-1",
          sourceImageGenerationId: "image-1",
          status: "running",
        },
      }),
    ]);
    expect(plan.scenes[0]?.action).toBe("extend");
  });

  it("prefers a native still over paying to extend", () => {
    const plan = planReframe([
      scene({
        hasNativeImage: true,
        existingVariantImage: {
          generationId: "variant-1",
          sourceImageGenerationId: "image-1",
          status: "succeeded",
        },
      }),
    ]);
    expect(plan.scenes[0]?.action).toBe("native");
  });
});

describe("the totals the confirmation is built from", () => {
  const mixed = planReframe([
    scene({ sceneId: "a", sceneNumber: 1 }),
    scene({ sceneId: "b", sceneNumber: 2 }),
    scene({ sceneId: "c", sceneNumber: 3, hasNativeImage: true }),
    scene({
      sceneId: "d",
      sceneNumber: 4,
      approvedImage: { generationId: "i4", source: "user_uploaded" },
    }),
    scene({ sceneId: "e", sceneNumber: 5, approvedImage: null }),
  ]);

  it("counts only the scenes that will actually be charged", () => {
    expect(mixed.extendCount).toBe(2);
  });

  it("counts the lossy and the blocked separately, since they differ", () => {
    expect(mixed.cropCount).toBe(1);
    expect(mixed.blockedCount).toBe(1);
    expect(mixed.readyCount).toBe(1);
  });

  it("accounts for every scene exactly once", () => {
    expect(
      mixed.extendCount +
        mixed.cropCount +
        mixed.blockedCount +
        mixed.readyCount,
    ).toBe(mixed.scenes.length);
  });

  it("keeps a reason on every scene, including the free ones", () => {
    for (const planned of mixed.scenes)
      expect(planned.reason.trim().length).toBeGreaterThan(0);
  });

  it("handles a project with no scenes", () => {
    const empty = planReframe([]);
    expect(empty.scenes).toEqual([]);
    expect(empty.extendCount).toBe(0);
  });
});
