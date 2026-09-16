import {
  MAX_SHOTS_PER_SCENE,
  MINIMUM_SHOT_DURATION_MILLISECONDS,
} from "@/lib/scenes/shot-timing";
import type {
  RenderCameraMotion,
  RenderSceneTransition,
} from "@/lib/render/render-timeline-snapshot";
import type { PacingProfile } from "@/lib/pacing/pacing-profile";

/**
 * What a pacing profile decides for one scene.
 *
 * The split here is deliberate and is the honest part of the feature. Camera
 * motion and the scene transition are **decided**: they cost nothing, they are
 * computed when a render is requested, and they are frozen into that render's
 * snapshot like every other choice. The number of images a scene should hold is
 * only **advised**, because acting on it means generating images, and images
 * cost money. A pacing setting that quietly queued paid work would be a
 * spending control disguised as a preference.
 */

export interface ScenePacingPlan {
  cameraMotion: RenderCameraMotion;
  transition: RenderSceneTransition;
  /**
   * How many images this scene would ideally hold at this pace. Advice for the
   * storyboard; nothing generates from it.
   */
  targetShotCount: number;
}

export function planScenePacing(input: {
  profile: PacingProfile;
  sceneNumber: number;
  /**
   * The scene's length. Prefer the measured narration duration, since that is
   * what the timeline is actually built from; the analysis estimate is a
   * reasonable stand-in before audio exists.
   */
  durationMilliseconds: number;
}): ScenePacingPlan {
  if (!Number.isInteger(input.sceneNumber) || input.sceneNumber < 1)
    throw new RangeError("Scene number must be a positive integer.");

  return {
    cameraMotion: pickCameraMotion(input.profile, input.sceneNumber),
    transition:
      input.sceneNumber <= 1
        ? input.profile.openingTransition
        : input.profile.sceneTransition,
    targetShotCount: planTargetShotCount(
      input.profile,
      input.durationMilliseconds,
    ),
  };
}

/**
 * Cycles the profile's moves by scene position.
 *
 * Position rather than content, still — a scene's own words are not something
 * this layer can read. What changed is that the *set* of moves is now a
 * decision rather than one fixed list, so a documentary stops panning and a
 * short stops varying.
 */
function pickCameraMotion(
  profile: PacingProfile,
  sceneNumber: number,
): RenderCameraMotion {
  const cycle = profile.motionCycle;
  if (cycle.length === 0) return "none";
  return cycle[(sceneNumber - 1) % cycle.length]!;
}

/**
 * How many images this scene wants, bounded by what it can actually show.
 *
 * Two ceilings apply and both are real. A scene cannot hold more images than
 * the renderer allows, and it cannot hold more than its own length divides into
 * readable moments — `placeShotsOnCueBoundaries` refuses a scene too short to
 * give every image its minimum time and falls back to a single still. Advising
 * a count that the placer would reject would be advice that does nothing.
 */
export function planTargetShotCount(
  profile: PacingProfile,
  durationMilliseconds: number,
): number {
  if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0)
    return 1;

  const wanted = Math.round(durationMilliseconds / profile.millisecondsPerShot);
  const readable = Math.floor(
    durationMilliseconds / MINIMUM_SHOT_DURATION_MILLISECONDS,
  );

  return Math.max(1, Math.min(wanted, readable, MAX_SHOTS_PER_SCENE));
}

/**
 * How a scene stands against the pace, for the storyboard to report.
 *
 * `sparse` is worth saying out loud and `dense` is not worth acting on: having
 * more images than the pace asks for is a choice someone made deliberately, and
 * nagging about it would be the tool second-guessing its user.
 */
export type ScenePacingFit = "sparse" | "on_pace" | "dense";

export function describeScenePacingFit(input: {
  approvedShotCount: number;
  targetShotCount: number;
}): ScenePacingFit {
  if (input.approvedShotCount < input.targetShotCount) return "sparse";
  if (input.approvedShotCount > input.targetShotCount) return "dense";
  return "on_pace";
}
