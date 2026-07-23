import type { SceneImageApiSize } from "@/lib/scenes/scene-image-view";

export type SceneImageSizeOption = {
  value: SceneImageApiSize;
  label: string;
  description: string;
};

/** Shared by both the single-scene and storyboard size pickers so they can't drift. */
export const SCENE_IMAGE_SIZE_OPTIONS: readonly SceneImageSizeOption[] = [
  { value: "1536x1024", label: "Landscape", description: "1536 x 1024" },
  { value: "1024x1536", label: "Portrait", description: "1024 x 1536" },
  { value: "1024x1024", label: "Square", description: "1024 x 1024" },
];

export function getSceneImageSizeLabel(size: SceneImageApiSize): string {
  return (
    SCENE_IMAGE_SIZE_OPTIONS.find((option) => option.value === size)?.label ??
    size
  );
}
