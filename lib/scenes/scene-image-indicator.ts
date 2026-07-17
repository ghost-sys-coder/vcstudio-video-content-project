import type { ImageGenerationStatus, ImageReviewStatus } from "@/db/schema";
import { isActiveImageGenerationStatus } from "@/lib/domain/bulk-scene-image";

export type SceneImageIndicatorState =
  "none" | "generating" | "failed" | "generated" | "approved";

export interface SceneImageIndicator {
  state: SceneImageIndicatorState;
}

interface SceneImageIndicatorGeneration {
  status: ImageGenerationStatus;
  reviewStatus: ImageReviewStatus;
  generationVersion: number;
}

/**
 * Summarizes a scene's current-version image generations into a single at-a-
 * glance indicator. Approval wins over any other state, then an in-flight
 * generation, then a usable image, then a failure.
 */
export function buildSceneImageIndicator(
  generations: SceneImageIndicatorGeneration[],
): SceneImageIndicator {
  if (generations.length === 0) return { state: "none" };

  let hasSucceeded = false;
  let hasApproved = false;
  let latest: SceneImageIndicatorGeneration | null = null;
  for (const generation of generations) {
    if (generation.status === "succeeded") hasSucceeded = true;
    if (
      generation.status === "succeeded" &&
      generation.reviewStatus === "approved"
    )
      hasApproved = true;
    if (!latest || generation.generationVersion > latest.generationVersion)
      latest = generation;
  }

  if (hasApproved) return { state: "approved" };
  if (latest && isActiveImageGenerationStatus(latest.status))
    return { state: "generating" };
  if (hasSucceeded) return { state: "generated" };
  if (latest?.status === "failed") return { state: "failed" };
  return { state: "none" };
}

/**
 * Groups generations (already scoped to current scene versions) by scene id and
 * returns an indicator per scene.
 */
export function buildSceneImageIndicatorMap(
  generations: Array<SceneImageIndicatorGeneration & { sceneId: string }>,
): Map<string, SceneImageIndicator> {
  const bySceneId = new Map<string, SceneImageIndicatorGeneration[]>();
  for (const generation of generations) {
    const existing = bySceneId.get(generation.sceneId);
    if (existing) existing.push(generation);
    else bySceneId.set(generation.sceneId, [generation]);
  }
  const indicators = new Map<string, SceneImageIndicator>();
  for (const [sceneId, sceneGenerations] of bySceneId)
    indicators.set(sceneId, buildSceneImageIndicator(sceneGenerations));
  return indicators;
}
