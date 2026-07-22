export const TIKTOK_MAX_VIDEO_BYTES = 4_294_967_296;
export const TIKTOK_MAX_DURATION_MILLISECONDS = 600_000;
export const TIKTOK_MIN_DIMENSION = 360;
export const TIKTOK_MAX_DIMENSION = 4096;
export const TIKTOK_MIN_FRAMES_PER_SECOND = 23;
export const TIKTOK_MAX_FRAMES_PER_SECOND = 60;

export type TikTokUploadAsset = {
  width: number;
  height: number;
  framesPerSecond: number;
  durationMilliseconds: number;
  sizeBytes: number;
  contentType: string | null;
};

export type TikTokUploadValidation =
  { eligible: true; reason: null } | { eligible: false; reason: string };

export function validateTikTokUploadAsset(
  asset: TikTokUploadAsset,
): TikTokUploadValidation {
  if (asset.contentType !== "video/mp4")
    return { eligible: false, reason: "TikTok requires an MP4 render." };
  if (
    asset.width < TIKTOK_MIN_DIMENSION ||
    asset.height < TIKTOK_MIN_DIMENSION ||
    asset.width > TIKTOK_MAX_DIMENSION ||
    asset.height > TIKTOK_MAX_DIMENSION
  )
    return {
      eligible: false,
      reason:
        "TikTok requires both dimensions to be between 360 and 4096 pixels.",
    };
  if (
    asset.framesPerSecond < TIKTOK_MIN_FRAMES_PER_SECOND ||
    asset.framesPerSecond > TIKTOK_MAX_FRAMES_PER_SECOND
  )
    return { eligible: false, reason: "TikTok requires 23–60 FPS." };
  if (
    asset.durationMilliseconds <= 0 ||
    asset.durationMilliseconds > TIKTOK_MAX_DURATION_MILLISECONDS
  )
    return {
      eligible: false,
      reason: "TikTok inbox uploads cannot exceed 10 minutes.",
    };
  if (asset.sizeBytes > TIKTOK_MAX_VIDEO_BYTES)
    return { eligible: false, reason: "TikTok videos cannot exceed 4 GB." };
  return { eligible: true, reason: null };
}
