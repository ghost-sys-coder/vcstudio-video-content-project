import { describe, expect, it } from "vitest";
import {
  filterStoryboardScenes,
  sceneMatchesStoryboardFilter,
} from "@/lib/scenes/storyboard-filter";
import type { StoryboardSceneView } from "@/lib/scenes/storyboard-view";

function scene(
  overrides: Partial<StoryboardSceneView> & { sceneNumber: number },
): StoryboardSceneView {
  return {
    sceneId: `scene-${overrides.sceneNumber}`,
    sceneStatus: "approved",
    sceneVersionId: `version-${overrides.sceneNumber}`,
    narrationText: "Narration.",
    characterNames: [],
    durationMilliseconds: 4000,
    eligibility: "eligible",
    approvedImageUrl: null,
    latestImageUrl: null,
    latestGenerationId: null,
    latestStatus: null,
    latestReviewStatus: null,
    latestGenerationVersion: null,
    progressPercent: 0,
    estimatedCostCents: null,
    actualCostCents: null,
    safeErrorMessage: null,
    ...overrides,
  };
}

const scenes: StoryboardSceneView[] = [
  scene({ sceneNumber: 1, eligibility: "eligible" }),
  scene({
    sceneNumber: 2,
    eligibility: "inProgress",
    latestStatus: "running",
  }),
  scene({
    sceneNumber: 3,
    eligibility: "eligible",
    latestStatus: "succeeded",
    latestReviewStatus: "pending",
    latestGenerationId: "gen-3",
  }),
  scene({
    sceneNumber: 4,
    eligibility: "hasApprovedImage",
    latestStatus: "succeeded",
    latestReviewStatus: "approved",
    approvedImageUrl: "/image",
  }),
  scene({ sceneNumber: 5, eligibility: "eligible", latestStatus: "failed" }),
];

describe("sceneMatchesStoryboardFilter", () => {
  it("matches all scenes for the 'all' filter", () => {
    expect(scenes.every((s) => sceneMatchesStoryboardFilter(s, "all"))).toBe(
      true,
    );
  });

  it("selects only in-progress scenes", () => {
    expect(
      filterStoryboardScenes(scenes, "inProgress").map((s) => s.sceneNumber),
    ).toEqual([2]);
  });

  it("selects only scenes needing review", () => {
    expect(
      filterStoryboardScenes(scenes, "needsReview").map((s) => s.sceneNumber),
    ).toEqual([3]);
  });

  it("selects only approved scenes", () => {
    expect(
      filterStoryboardScenes(scenes, "approved").map((s) => s.sceneNumber),
    ).toEqual([4]);
  });

  it("selects only failed scenes", () => {
    expect(
      filterStoryboardScenes(scenes, "failed").map((s) => s.sceneNumber),
    ).toEqual([5]);
  });

  it("selects only fresh eligible scenes", () => {
    expect(
      filterStoryboardScenes(scenes, "eligible").map((s) => s.sceneNumber),
    ).toEqual([1, 3, 5]);
  });
});
