import { isActiveImageGenerationStatus } from "@/lib/domain/bulk-scene-image";
import type { StoryboardSceneView } from "@/lib/scenes/storyboard-view";

export type StoryboardFilter =
  "all" | "eligible" | "inProgress" | "needsReview" | "approved" | "failed";

export const STORYBOARD_FILTERS: ReadonlyArray<{
  value: StoryboardFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "eligible", label: "Eligible" },
  { value: "inProgress", label: "In progress" },
  { value: "needsReview", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "failed", label: "Failed" },
];

export function sceneMatchesStoryboardFilter(
  scene: StoryboardSceneView,
  filter: StoryboardFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "eligible":
      return scene.eligibility === "eligible";
    case "inProgress":
      return (
        scene.latestStatus !== null &&
        isActiveImageGenerationStatus(scene.latestStatus)
      );
    case "needsReview":
      return (
        scene.latestStatus === "succeeded" &&
        scene.latestReviewStatus === "pending"
      );
    case "approved":
      return scene.approvedImageUrl !== null;
    case "failed":
      return scene.latestStatus === "failed";
    default:
      return true;
  }
}

export function filterStoryboardScenes(
  scenes: StoryboardSceneView[],
  filter: StoryboardFilter,
): StoryboardSceneView[] {
  return scenes.filter((scene) => sceneMatchesStoryboardFilter(scene, filter));
}
