import type { SceneContent } from "@/lib/schemas/scene";

export type TimedSceneContent = SceneContent & {
  startTimeMilliseconds: number;
  endTimeMilliseconds: number;
};

export function calculateSceneTimings(
  scenes: SceneContent[],
  limits: { minimum: number; maximum: number },
): TimedSceneContent[] {
  let cursor = 0;
  return scenes.map((scene) => {
    const duration = Math.min(
      limits.maximum,
      Math.max(limits.minimum, scene.estimatedDurationMilliseconds),
    );
    const timed = {
      ...scene,
      estimatedDurationMilliseconds: duration,
      startTimeMilliseconds: cursor,
      endTimeMilliseconds: cursor + duration,
    };
    cursor = timed.endTimeMilliseconds;
    return timed;
  });
}
