import { describe, expect, it } from "vitest";
import { planSceneClip } from "@/lib/video-models/plan-scene-clip";
import type { VideoModelCapabilities } from "@/lib/video-models/video-model-capabilities";

function model(
  overrides: Partial<VideoModelCapabilities> = {},
): VideoModelCapabilities {
  return {
    modes: ["imageToVideo", "textToVideo"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    maxResolutionHeight: 1080,
    minDurationSeconds: 5,
    maxDurationSeconds: 10,
    discreteDurationsSeconds: [5, 10],
    producesAudio: false,
    costCentsPerSecond: 10,
    ...overrides,
  };
}

function plan(
  overrides: {
    capabilities?: VideoModelCapabilities;
    sceneDurationMilliseconds?: number;
    hasApprovedStill?: boolean;
    mode?: "imageToVideo" | "textToVideo";
    aspectRatio?: "16:9" | "9:16" | "1:1";
  } = {},
) {
  return planSceneClip({
    capabilities: overrides.capabilities ?? model(),
    mode: overrides.mode ?? "imageToVideo",
    aspectRatio: overrides.aspectRatio ?? "16:9",
    sceneDurationMilliseconds: overrides.sceneDurationMilliseconds ?? 30_000,
    hasApprovedStill: overrides.hasApprovedStill ?? true,
  });
}

describe("covering a scene that is far longer than any clip", () => {
  it("takes the longest length the model sells and repeats it", () => {
    // The whole shape of the feature. A thirty second scene cannot be one
    // generation, so it is ten seconds of motion played three times.
    const result = plan({ sceneDurationMilliseconds: 30_000 });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect(result.durationSeconds).toBe(10);
    expect(result.loopCount).toBe(3);
  });

  it("charges for the clip once, not once per repeat", () => {
    // The reason to prefer a short clip that loops over a long one that does
    // not: the repeat is free.
    const result = plan({ sceneDurationMilliseconds: 60_000 });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect(result.estimatedCostCents).toBe(100);
  });

  it("says plainly when the repeat will be visible", () => {
    const result = plan({
      sceneDurationMilliseconds: 90_000,
      capabilities: model({ discreteDurationsSeconds: [5] }),
    });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect(result.loopCount).toBe(18);
    expect(result.loopWarning).toContain("repeats");
  });

  it("stays quiet when the repeat will not be noticed", () => {
    // A warning that always fires is one nobody reads.
    const result = plan({ sceneDurationMilliseconds: 20_000 });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect(result.loopWarning).toBeNull();
  });
});

describe("a scene shorter than the shortest clip", () => {
  it("buys the shortest clip and cuts the tail", () => {
    const result = plan({ sceneDurationMilliseconds: 2_000 });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect(result.durationSeconds).toBe(5);
    expect(result.trimmed).toBe(true);
    expect(result.loopCount).toBe(1);
  });
});

describe("only asking for lengths the model actually sells", () => {
  it("never invents a length between two fixed options", () => {
    // Asking a model that sells 5 and 10 for 7 is a provider rejection, not a
    // rounding this can absorb quietly.
    const result = plan({ sceneDurationMilliseconds: 7_000 });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect([5, 10]).toContain(result.durationSeconds);
    expect(result.durationSeconds).toBe(5);
  });

  it("uses whole seconds across a continuous range", () => {
    const result = plan({
      sceneDurationMilliseconds: 8_400,
      capabilities: model({
        discreteDurationsSeconds: undefined,
        minDurationSeconds: 2,
        maxDurationSeconds: 12,
      }),
    });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect(result.durationSeconds).toBe(8);
  });
});

describe("holding the resolution down on purpose", () => {
  it("refuses to buy more pixels than the render can use", () => {
    const result = plan({ capabilities: model({ maxResolutionHeight: 2160 }) });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect(result.resolutionHeight).toBe(720);
  });

  it("does not ask a smaller model for more than it has", () => {
    const result = plan({ capabilities: model({ maxResolutionHeight: 480 }) });
    if (result.outcome !== "planned") throw new Error("expected a plan");
    expect(result.resolutionHeight).toBe(480);
  });
});

describe("refusing before anything is spent", () => {
  it("will not animate a scene with no approved image", () => {
    const result = plan({ hasApprovedStill: false });
    expect(result.outcome).toBe("refused");
    if (result.outcome === "refused")
      expect(result.reason).toContain("Approve an image");
  });

  it("will not ask a model for a shape it does not make", () => {
    const result = plan({
      aspectRatio: "9:16",
      capabilities: model({ aspectRatios: ["16:9"] }),
    });
    expect(result.outcome).toBe("refused");
  });

  it("will not ask a text-only model to animate a still", () => {
    const result = plan({ capabilities: model({ modes: ["textToVideo"] }) });
    expect(result.outcome).toBe("refused");
  });

  it("will not plan a scene whose narration does not exist yet", () => {
    // Without narration there is no length, and a clip with no length is a
    // guess at the creator's expense.
    const result = plan({ sceneDurationMilliseconds: 0 });
    expect(result.outcome).toBe("refused");
  });

  it("will not plan against a model with no usable length", () => {
    const result = plan({
      capabilities: model({ discreteDurationsSeconds: [30] }),
    });
    expect(result.outcome).toBe("refused");
  });
});

describe("generating without a still", () => {
  it("allows text to video when the model offers it", () => {
    const result = plan({ mode: "textToVideo", hasApprovedStill: false });
    expect(result.outcome).toBe("planned");
  });
});
