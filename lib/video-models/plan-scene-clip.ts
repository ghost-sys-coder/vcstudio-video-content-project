/**
 * Decides what to ask a video model for, to cover one scene.
 *
 * **The constraint that shapes the whole feature.** Video models make clips of
 * a few seconds. Explainer scenes run for as long as their narration, routinely
 * thirty seconds to a minute. The two do not meet, and no amount of prompting
 * closes the gap.
 *
 * So a scene's clip is not the scene. It is a short piece of motion that plays
 * under the narration and repeats, the way a good explainer holds a moving
 * illustration while a voice talks over it. That is also the answer to slop: a
 * few seconds of deliberate motion generated from an already approved still is
 * a different thing from sixty seconds of a model inventing narrative, and it
 * costs a fraction as much.
 *
 * Pure, and separate from the request, because this decides what gets spent.
 */

import {
  listSelectableDurations,
  resolveClipResolutionHeight,
  supportsAspectRatio,
  supportsMode,
  type VideoAspectRatio,
  type VideoGenerationMode,
  type VideoModelCapabilities,
} from "@/lib/video-models/video-model-capabilities";

/**
 * Above this many repeats the motion reads as a loop rather than as life.
 *
 * Not a refusal, because a looping illustration is still better than a frozen
 * one, and the person asking may know the motion is subtle enough to carry it.
 * It is said out loud so the choice is theirs.
 */
const NOTICEABLE_LOOP_COUNT = 6;

export type SceneClipPlan =
  | {
      outcome: "planned";
      mode: VideoGenerationMode;
      /** What we ask the model for, always a length it actually sells. */
      durationSeconds: number;
      resolutionHeight: number;
      aspectRatio: VideoAspectRatio;
      /** How many times the clip plays to cover the scene. One means no repeat. */
      loopCount: number;
      /** True when the clip outlasts the scene and the tail is cut. */
      trimmed: boolean;
      estimatedCostCents: number;
      /** Said plainly when the repeat will be visible. Null when it will not. */
      loopWarning: string | null;
    }
  | { outcome: "refused"; reason: string };

export function planSceneClip(input: {
  capabilities: VideoModelCapabilities;
  mode: VideoGenerationMode;
  aspectRatio: VideoAspectRatio;
  sceneDurationMilliseconds: number;
  /** Animating an approved still is impossible without one. */
  hasApprovedStill: boolean;
}): SceneClipPlan {
  const { capabilities } = input;

  if (input.sceneDurationMilliseconds <= 0)
    return {
      outcome: "refused",
      reason: "This scene has no narration yet, so its length is unknown.",
    };

  if (!supportsMode(capabilities, input.mode))
    return {
      outcome: "refused",
      reason:
        input.mode === "imageToVideo"
          ? "This model cannot animate an existing image."
          : "This model cannot generate from a description alone.",
    };

  if (input.mode === "imageToVideo" && !input.hasApprovedStill)
    return {
      outcome: "refused",
      reason:
        "Approve an image for this scene first; the clip is made from it.",
    };

  if (!supportsAspectRatio(capabilities, input.aspectRatio))
    return {
      outcome: "refused",
      reason: `This model does not produce ${input.aspectRatio} video.`,
    };

  const durations = listSelectableDurations(capabilities);
  if (durations.length === 0)
    return {
      outcome: "refused",
      reason: "This model has no usable clip length configured.",
    };

  const sceneSeconds = input.sceneDurationMilliseconds / 1000;

  // The longest length that still fits inside the scene, so the repeat is as
  // infrequent as the model allows. When even the shortest clip outlasts the
  // scene we take that shortest one and cut the tail: paying for a few unused
  // seconds beats paying for a longer clip we would cut further.
  const fitting = durations.filter((seconds) => seconds <= sceneSeconds);
  const durationSeconds =
    fitting.length > 0 ? Math.max(...fitting) : Math.min(...durations);
  const trimmed = durationSeconds > sceneSeconds;
  const loopCount = trimmed ? 1 : Math.ceil(sceneSeconds / durationSeconds);

  return {
    outcome: "planned",
    mode: input.mode,
    durationSeconds,
    resolutionHeight: resolveClipResolutionHeight(capabilities),
    aspectRatio: input.aspectRatio,
    loopCount,
    trimmed,
    // Charged once. The repeat is free, which is the reason to prefer a short
    // clip that loops over a long one that does not.
    estimatedCostCents: Math.ceil(
      durationSeconds * capabilities.costCentsPerSecond,
    ),
    loopWarning:
      loopCount > NOTICEABLE_LOOP_COUNT
        ? `This scene runs ${Math.round(sceneSeconds)} seconds, so a ${durationSeconds} second clip repeats ${loopCount} times and the loop will be visible. Splitting the scene, or choosing a model that makes longer clips, would hide it.`
        : null,
  };
}
