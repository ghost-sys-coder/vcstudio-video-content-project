/**
 * What a video generation model can do, expressed so that one gateway can drive
 * any of them.
 *
 * **Why capabilities are data rather than code.** The point of the gateway is
 * that adding a model should not mean writing a model. Every provider differs
 * on the few things that actually matter to us: whether it can start from an
 * image, which shapes it emits, how long a clip may be, whether the length is
 * free or drawn from a fixed menu, and what a second costs. Describe those five
 * things and the rest of the system can plan, price and refuse without knowing
 * whose model it is.
 *
 * **Why there is a resolution ceiling.** Explainer video is the product here,
 * not spectacle. Generating at the highest resolution a model offers costs more
 * for footage that is then scaled into a 1080-tall frame, and it pushes models
 * towards the glossy hyperreal look that reads as machine-made. The ceiling is
 * a deliberate product decision, applied to every model regardless of what it
 * is willing to sell.
 */

export type VideoGenerationMode =
  /** Animate a supplied still. The only mode that preserves an approved look. */
  | "imageToVideo"
  /** Invent the footage from words alone. */
  | "textToVideo";

export type VideoAspectRatio = "16:9" | "9:16" | "1:1";

/**
 * The tallest frame we will ask any model for.
 *
 * Renders are 1080 tall, so 720 is one clean step below and upscales without
 * looking soft once motion is in it. Asking for more spends more on footage
 * that gets scaled down anyway.
 */
export const MAX_CLIP_RESOLUTION_HEIGHT = 720;

export interface VideoModelCapabilities {
  /** Empty is meaningless, so a model with no modes cannot be registered. */
  modes: VideoGenerationMode[];
  aspectRatios: VideoAspectRatio[];
  /** The tallest the model itself offers, before our own ceiling is applied. */
  maxResolutionHeight: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  /**
   * Present when the model sells fixed lengths rather than any value in range.
   * Most of them do, and asking for 7 seconds from a model that sells 5 and 10
   * is an error at the provider rather than a rounding we can absorb silently.
   */
  discreteDurationsSeconds?: number[];
  /**
   * Whether the model returns sound. We always supply our own narration, so a
   * model's audio track is discarded; this exists so the gateway can mute it
   * deliberately rather than letting two soundtracks reach the renderer.
   */
  producesAudio: boolean;
  costCentsPerSecond: number;
}

/** The resolution we will actually request, never more than the ceiling. */
export function resolveClipResolutionHeight(
  capabilities: VideoModelCapabilities,
): number {
  return Math.min(capabilities.maxResolutionHeight, MAX_CLIP_RESOLUTION_HEIGHT);
}

/**
 * The clip lengths a model will accept, shortest first.
 *
 * A continuous range is reported as its endpoints plus whole seconds between,
 * because every provider we have met bills and accepts whole seconds, and a
 * fractional request is a rejection waiting to happen.
 */
export function listSelectableDurations(
  capabilities: VideoModelCapabilities,
): number[] {
  if (capabilities.discreteDurationsSeconds?.length)
    return [...capabilities.discreteDurationsSeconds]
      .filter(
        (seconds) =>
          seconds >= capabilities.minDurationSeconds &&
          seconds <= capabilities.maxDurationSeconds,
      )
      .sort((left, right) => left - right);

  const durations: number[] = [];
  for (
    let seconds = Math.ceil(capabilities.minDurationSeconds);
    seconds <= Math.floor(capabilities.maxDurationSeconds);
    seconds += 1
  )
    durations.push(seconds);
  return durations;
}

export function supportsMode(
  capabilities: VideoModelCapabilities,
  mode: VideoGenerationMode,
): boolean {
  return capabilities.modes.includes(mode);
}

export function supportsAspectRatio(
  capabilities: VideoModelCapabilities,
  aspectRatio: VideoAspectRatio,
): boolean {
  return capabilities.aspectRatios.includes(aspectRatio);
}
