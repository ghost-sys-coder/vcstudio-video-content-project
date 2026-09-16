import type {
  RenderCameraMotion,
  RenderSceneTransition,
} from "@/lib/render/render-timeline-snapshot";

/**
 * How busy a video should feel, as policy rather than as a per-scene chore.
 *
 * **Pacing here cannot change how long a video runs, and pretending otherwise
 * would be the central mistake.** The render timeline is built from the
 * *measured* narration recording — `buildVideoTimeline` treats it as
 * authoritative and reports the analysis estimate's disagreement as a warning,
 * not a correction. Fewer words or a faster voice make a shorter video; nothing
 * downstream of the recording can. What a profile controls is how much visibly
 * happens while those words play: how often the picture changes, how the camera
 * moves, and how one scene gives way to the next.
 *
 * **Before this, two of those three were functions of the scene's number.**
 * Camera motion cycled through four moves by position, and every scene after
 * the first faded in. Neither knew the scene's length, its content or where the
 * video was going — which is exactly why a finished video could feel assembled
 * rather than timed.
 */

export type PacingProfileId = "documentary" | "explainer" | "short";

export interface PacingProfile {
  id: PacingProfileId;
  label: string;
  description: string;
  /**
   * Camera moves cycled across scenes. One entry means every scene moves the
   * same way, which is a choice rather than a limitation: a constant gentle
   * push reads as energy where a varied one reads as restlessness.
   */
  motionCycle: readonly RenderCameraMotion[];
  /** How the first scene arrives. There is nothing behind it to fade from. */
  openingTransition: RenderSceneTransition;
  /** How every later scene arrives. */
  sceneTransition: RenderSceneTransition;
  /**
   * Roughly how much narration one image should cover.
   *
   * Expressed as time rather than as a count because scenes differ in length:
   * a fixed "three images per scene" gives a twenty-second scene a change every
   * seven seconds and a four-second scene a slideshow.
   */
  millisecondsPerShot: number;
}

/**
 * The profiles, chosen for what the format actually does to a viewer.
 *
 * `explainer` reproduces the previous behaviour exactly — the same four-move
 * cycle, the same cut-then-fade — so it is the default and no existing project
 * changes because this feature arrived.
 */
export const PACING_PROFILES: Readonly<Record<PacingProfileId, PacingProfile>> =
  {
    documentary: {
      id: "documentary",
      label: "Documentary",
      description:
        "Long looks, slow moves, soft scene changes. Suits material that asks the viewer to think rather than keep up.",
      // Pans are dropped, not forgotten: across a long scene a pan drifts far
      // enough to become the subject, while a slow zoom stays underneath it.
      motionCycle: ["zoomIn", "zoomOut"],
      openingTransition: "fade",
      sceneTransition: "fade",
      millisecondsPerShot: 15_000,
    },
    explainer: {
      id: "explainer",
      label: "Explainer",
      description:
        "Balanced. Enough visual change to hold attention without outrunning the explanation.",
      motionCycle: ["zoomIn", "zoomOut", "panLeft", "panRight"],
      openingTransition: "cut",
      sceneTransition: "fade",
      millisecondsPerShot: 8_000,
    },
    short: {
      id: "short",
      label: "Short",
      description:
        "Frequent changes and hard cuts. Density is the point; the picture should rarely sit still.",
      // One move, and cuts rather than fades. On a picture held for three
      // seconds a pan travels too little to notice and a fade spends a
      // meaningful share of the shot dissolving, which blunts the rhythm that
      // makes the format work.
      motionCycle: ["zoomIn"],
      openingTransition: "cut",
      sceneTransition: "cut",
      millisecondsPerShot: 3_500,
    },
  } as const;

/**
 * The profile applied when a project has not chosen one.
 *
 * `explainer` rather than a neutral fourth option, because it is byte-for-byte
 * the behaviour every existing project already renders with.
 */
export const DEFAULT_PACING_PROFILE_ID: PacingProfileId = "explainer";

export const PACING_PROFILE_IDS = Object.keys(
  PACING_PROFILES,
) as PacingProfileId[];

export function isPacingProfileId(value: string): value is PacingProfileId {
  return Object.hasOwn(PACING_PROFILES, value);
}

/**
 * Resolves a stored value to a profile, falling back rather than throwing.
 *
 * A render must not fail because a profile was renamed or a row predates the
 * column. Falling back to the default reproduces the historical behaviour,
 * which is the safest thing an unknown value can mean.
 */
export function resolvePacingProfile(value: string | null): PacingProfile {
  if (value && isPacingProfileId(value)) return PACING_PROFILES[value];
  return PACING_PROFILES[DEFAULT_PACING_PROFILE_ID];
}
