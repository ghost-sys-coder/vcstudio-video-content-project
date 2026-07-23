import type {
  SceneImageApiSize,
  SceneImageGenerationView,
} from "@/lib/scenes/scene-image-view";
import { SCENE_IMAGE_SIZE_OPTIONS } from "@/lib/scenes/scene-image-size-options";

export type SceneImageSizeGroupView = {
  size: SceneImageApiSize;
  generations: SceneImageGenerationView[];
};

/**
 * Groups a scene's generation history by size, one section per size that has
 * at least one generation, in the fixed landscape/portrait/square display
 * order — a scene can now have an approved image per size, not just one.
 */
export function groupSceneImageGenerationsBySize(
  generations: readonly SceneImageGenerationView[],
): SceneImageSizeGroupView[] {
  const groups = new Map<SceneImageApiSize, SceneImageGenerationView[]>();
  for (const generation of generations) {
    const bucket = groups.get(generation.size);
    if (bucket) bucket.push(generation);
    else groups.set(generation.size, [generation]);
  }
  return SCENE_IMAGE_SIZE_OPTIONS.map((option) => option.value)
    .filter((size) => groups.has(size))
    .map((size) => ({ size, generations: groups.get(size)! }));
}
