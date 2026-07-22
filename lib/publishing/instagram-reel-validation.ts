export const INSTAGRAM_REEL_MAX_BYTES = 1_073_741_824;
export const INSTAGRAM_REEL_MAX_WIDTH = 1920;
export const INSTAGRAM_REEL_MIN_DURATION_MILLISECONDS = 3000;
export const INSTAGRAM_REEL_MAX_DURATION_MILLISECONDS = 900_000;
export const INSTAGRAM_REEL_MIN_FRAMES_PER_SECOND = 23;
export const INSTAGRAM_REEL_MAX_FRAMES_PER_SECOND = 60;

export type InstagramReelAsset = {
  width: number;
  height: number;
  framesPerSecond: number;
  durationMilliseconds: number;
  sizeBytes: number;
  contentType: string | null;
};

export type InstagramReelValidation =
  { eligible: true; reason: null } | { eligible: false; reason: string };

export function validateInstagramReelAsset(
  asset: InstagramReelAsset,
): InstagramReelValidation {
  if (asset.width * 16 !== asset.height * 9)
    return {
      eligible: false,
      reason: "Instagram requires a vertical 9:16 render.",
    };
  if (
    asset.framesPerSecond < INSTAGRAM_REEL_MIN_FRAMES_PER_SECOND ||
    asset.framesPerSecond > INSTAGRAM_REEL_MAX_FRAMES_PER_SECOND
  )
    return { eligible: false, reason: "Instagram requires 23–60 FPS." };
  if (
    asset.durationMilliseconds < INSTAGRAM_REEL_MIN_DURATION_MILLISECONDS ||
    asset.durationMilliseconds > INSTAGRAM_REEL_MAX_DURATION_MILLISECONDS
  )
    return {
      eligible: false,
      reason: "Instagram Reels must be 3 seconds to 15 minutes.",
    };
  if (asset.sizeBytes > INSTAGRAM_REEL_MAX_BYTES)
    return { eligible: false, reason: "Instagram Reels cannot exceed 1 GB." };
  if (asset.width > INSTAGRAM_REEL_MAX_WIDTH)
    return {
      eligible: false,
      reason: "Instagram cannot accept more than 1920 horizontal pixels.",
    };
  if (asset.contentType !== "video/mp4")
    return { eligible: false, reason: "Instagram requires an MP4 render." };
  return { eligible: true, reason: null };
}
