/**
 * Translating between what a scene needs and what OpenAI's video API accepts.
 *
 * Pure, so the whole translation is testable without a key. Every allowed value
 * here was read from the installed SDK's own types rather than from memory:
 * sizes are `720x1280 | 1280x720 | 1024x1792 | 1792x1024`, lengths are the
 * strings `4 | 8 | 12`, and status is `queued | in_progress | completed |
 * failed`.
 *
 * **A welcome accident worth recording.** 1280x720 is exactly 16:9 and 720x1280
 * is exactly 9:16, so unlike the still image sizes, a clip fills the render
 * frame with nothing cropped. The crop in this feature happens earlier, when an
 * approved 3:2 still is fitted onto the 16:9 canvas Sora starts from.
 */

import type {
  VideoAspectRatio,
  VideoModelCapabilities,
} from "@/lib/video-models/video-model-capabilities";
import type { VideoGenerationStatus } from "@/lib/video-models/video-generation-provider";

/** The lengths the API sells, as it wants them: strings, not numbers. */
export const OPENAI_VIDEO_SECONDS = ["4", "8", "12"] as const;
export type OpenAiVideoSeconds = (typeof OPENAI_VIDEO_SECONDS)[number];

export const OPENAI_VIDEO_SIZES = {
  "16:9": "1280x720",
  "9:16": "720x1280",
} as const;

export type OpenAiVideoSize =
  (typeof OPENAI_VIDEO_SIZES)[keyof typeof OPENAI_VIDEO_SIZES];

/**
 * The canvas for a shape, or null when the API has none.
 *
 * Square is the null case and always will be: the API offers no 1:1 size. The
 * larger 1792x1024 and 1024x1792 canvases are deliberately not offered either.
 * They are 1.75:1 rather than 16:9, so they would reintroduce a crop, and their
 * 1024 height is above the ceiling this product sets on purpose.
 */
export function toOpenAiVideoSize(
  aspectRatio: VideoAspectRatio,
): OpenAiVideoSize | null {
  if (aspectRatio === "16:9") return OPENAI_VIDEO_SIZES["16:9"];
  if (aspectRatio === "9:16") return OPENAI_VIDEO_SIZES["9:16"];
  return null;
}

/** The pixel dimensions of a canvas, for fitting the start frame to it. */
export function getOpenAiVideoDimensions(size: OpenAiVideoSize): {
  width: number;
  height: number;
} {
  return size === "1280x720"
    ? { width: 1280, height: 720 }
    : { width: 720, height: 1280 };
}

/**
 * A planned length as the API wants it.
 *
 * Returns null rather than rounding, because the planner is supposed to have
 * chosen from the lengths the model sells. A value arriving here that is not
 * one of them is a bug upstream, and quietly rounding it would hide the bug
 * while charging for the wrong clip.
 */
export function toOpenAiVideoSeconds(
  durationSeconds: number,
): OpenAiVideoSeconds | null {
  const candidate = String(durationSeconds);
  return OPENAI_VIDEO_SECONDS.find((seconds) => seconds === candidate) ?? null;
}

/**
 * Capabilities for an OpenAI video model.
 *
 * The cost per second is supplied rather than written in, because the published
 * price is not something this file can know and a stale number here would
 * misprice every clip. It is configured, and deliberately set high by default:
 * over-reserving is released back on reconciliation, while under-reserving
 * spends past a budget that was supposed to stop it.
 */
export function createOpenAiVideoCapabilities(input: {
  costCentsPerSecond: number;
}): VideoModelCapabilities {
  return {
    modes: ["imageToVideo", "textToVideo"],
    // No square. The API has no 1:1 canvas, so a square project cannot have
    // clips from this provider, and saying so is better than silently
    // delivering the wrong shape.
    aspectRatios: ["16:9", "9:16"],
    maxResolutionHeight: 720,
    minDurationSeconds: 4,
    maxDurationSeconds: 12,
    discreteDurationsSeconds: [4, 8, 12],
    // Sora returns sound. We always lay our own narration over the clip, so the
    // renderer must mute it rather than play two soundtracks at once.
    producesAudio: true,
    costCentsPerSecond: input.costCentsPerSecond,
  };
}

/**
 * Maps a job's reported state onto the gateway's own.
 *
 * A failure carried in the payload is a job that failed, not a transport
 * problem, so it is returned rather than thrown. Retriability is decided from
 * the error code: the caller must never pay twice for a refusal that will
 * refuse again.
 */
export function toVideoGenerationStatus(input: {
  status: string;
  progress: number | null;
  errorCode: string | null;
  mimeType: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  actualCostCents: number | null;
}): VideoGenerationStatus {
  if (input.status === "failed")
    return {
      state: "failed",
      code: input.errorCode ?? "video_generation_failed",
      retriable: isRetriableOpenAiVideoError(input.errorCode),
    };

  if (input.status === "completed")
    return {
      state: "succeeded",
      mimeType: input.mimeType,
      durationMilliseconds:
        input.durationSeconds === null ? null : input.durationSeconds * 1000,
      width: input.width,
      height: input.height,
      actualCostCents: input.actualCostCents,
    };

  return { state: "running", progressPercent: input.progress };
}

/**
 * Whether asking again could plausibly succeed.
 *
 * Unknown codes are treated as permanent. Retrying a billable request on a
 * guess is how a single bad prompt becomes a repeated charge.
 */
export function isRetriableOpenAiVideoError(code: string | null): boolean {
  if (!code) return false;
  const normalized = code.toLowerCase();
  return (
    normalized.includes("rate_limit") ||
    normalized.includes("server_error") ||
    normalized.includes("timeout") ||
    normalized.includes("unavailable")
  );
}
