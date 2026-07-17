import { describe, expect, it } from "vitest";
import {
  buildSceneImageIndicator,
  buildSceneImageIndicatorMap,
} from "@/lib/scenes/scene-image-indicator";

describe("buildSceneImageIndicator", () => {
  it("returns none when there are no generations", () => {
    expect(buildSceneImageIndicator([]).state).toBe("none");
  });

  it("prefers approved over any other state", () => {
    expect(
      buildSceneImageIndicator([
        { status: "succeeded", reviewStatus: "approved", generationVersion: 1 },
        { status: "running", reviewStatus: "pending", generationVersion: 2 },
      ]).state,
    ).toBe("approved");
  });

  it("reports generating when the latest generation is active", () => {
    expect(
      buildSceneImageIndicator([
        { status: "succeeded", reviewStatus: "rejected", generationVersion: 1 },
        { status: "queued", reviewStatus: "pending", generationVersion: 2 },
      ]).state,
    ).toBe("generating");
  });

  it("reports generated when a succeeded image exists and nothing is active", () => {
    expect(
      buildSceneImageIndicator([
        { status: "succeeded", reviewStatus: "pending", generationVersion: 1 },
      ]).state,
    ).toBe("generated");
  });

  it("reports failed when the only generation failed", () => {
    expect(
      buildSceneImageIndicator([
        { status: "failed", reviewStatus: "pending", generationVersion: 1 },
      ]).state,
    ).toBe("failed");
  });
});

describe("buildSceneImageIndicatorMap", () => {
  it("groups indicators per scene id", () => {
    const map = buildSceneImageIndicatorMap([
      {
        sceneId: "scene-a",
        status: "succeeded",
        reviewStatus: "approved",
        generationVersion: 1,
      },
      {
        sceneId: "scene-b",
        status: "failed",
        reviewStatus: "pending",
        generationVersion: 1,
      },
    ]);
    expect(map.get("scene-a")?.state).toBe("approved");
    expect(map.get("scene-b")?.state).toBe("failed");
    expect(map.has("scene-c")).toBe(false);
  });
});
