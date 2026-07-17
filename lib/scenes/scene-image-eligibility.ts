import type { ImageGenerationStatus, SceneStatus } from "@/db/schema";
import { isActiveImageGenerationStatus } from "@/lib/domain/bulk-scene-image";

export type SceneBulkEligibility =
  "eligible" | "hasApprovedImage" | "inProgress" | "notApproved";

export interface StoryboardSceneEligibilityInput {
  sceneStatus: SceneStatus;
  hasApprovedImage: boolean;
  latestGenerationStatus: ImageGenerationStatus | null;
}

export function classifySceneBulkEligibility(
  input: StoryboardSceneEligibilityInput,
): SceneBulkEligibility {
  if (input.sceneStatus !== "approved") return "notApproved";
  if (
    input.latestGenerationStatus !== null &&
    isActiveImageGenerationStatus(input.latestGenerationStatus)
  )
    return "inProgress";
  if (input.hasApprovedImage) return "hasApprovedImage";
  return "eligible";
}

/**
 * A scene can be selected for a bulk request when it is approved and not
 * currently generating. Scenes that already have an approved image are
 * selectable so the user can deliberately regenerate them.
 */
export function isSceneSelectableForBulk(
  eligibility: SceneBulkEligibility,
): boolean {
  return eligibility === "eligible" || eligibility === "hasApprovedImage";
}

/**
 * "Generate all eligible" defaults to scenes that are approved and do not yet
 * have any image, so bulk generation never silently re-bills approved scenes.
 */
export function isSceneDefaultGenerateAll(
  eligibility: SceneBulkEligibility,
): boolean {
  return eligibility === "eligible";
}

export function isSceneRetryable(input: {
  sceneStatus: SceneStatus;
  latestGenerationStatus: ImageGenerationStatus | null;
}): boolean {
  return (
    input.sceneStatus === "approved" &&
    input.latestGenerationStatus === "failed"
  );
}
