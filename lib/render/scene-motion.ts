import type {
  RenderCameraMotion,
  RenderSceneTransition,
} from "@/lib/render/render-timeline-snapshot";

const MOTION_CYCLE: readonly RenderCameraMotion[] = [
  "zoomIn",
  "zoomOut",
  "panLeft",
  "panRight",
] as const;

/**
 * Assigns a subtle, deterministic camera move to a scene from its number.
 * Cycling the moves gives the video visual life while staying fully
 * reproducible: the same scene always gets the same motion.
 */
export function deriveSceneCameraMotion(
  sceneNumber: number,
): RenderCameraMotion {
  if (!Number.isInteger(sceneNumber) || sceneNumber < 1)
    throw new RangeError("Scene number must be a positive integer.");
  return MOTION_CYCLE[(sceneNumber - 1) % MOTION_CYCLE.length]!;
}

/**
 * The opening scene cuts in (nothing to fade from); every later scene fades in
 * so scene changes read smoothly.
 */
export function deriveSceneTransition(
  sceneNumber: number,
): RenderSceneTransition {
  if (!Number.isInteger(sceneNumber) || sceneNumber < 1)
    throw new RangeError("Scene number must be a positive integer.");
  return sceneNumber <= 1 ? "cut" : "fade";
}
