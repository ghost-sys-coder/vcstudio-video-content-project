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

/**
 * A scene matches a status filter when ANY of its per-size images match —
 * a scene can now have several sizes in different states at once.
 */
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
      return scene.images.some(
        (image) =>
          image.latestStatus !== null &&
          isActiveImageGenerationStatus(image.latestStatus),
      );
    case "needsReview":
      return scene.images.some(
        (image) =>
          image.latestStatus === "succeeded" &&
          image.latestReviewStatus === "pending",
      );
    case "approved":
      return scene.images.some((image) => image.approvedImageUrl !== null);
    case "failed":
      return scene.images.some((image) => image.latestStatus === "failed");
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
