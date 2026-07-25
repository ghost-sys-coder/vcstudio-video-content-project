/**
 * Unlike the Instagram/TikTok checks, this is advisory, not a gate. YouTube
 * accepts both long-form and Shorts uploads through the same endpoint and
 * auto-classifies a video as a Short purely from its shape and length, so a
 * render that fails this check is still a perfectly valid YouTube upload —
 * it just won't land as a Short.
 */
export const YOUTUBE_SHORTS_MAX_DURATION_MILLISECONDS = 180_000;

export type YouTubeShortsAsset = {
  width: number;
  height: number;
  durationMilliseconds: number;
};

export type YouTubeShortsEligibility =
  { eligible: true; reason: null } | { eligible: false; reason: string };

export function evaluateYouTubeShortsEligibility(
  asset: YouTubeShortsAsset,
): YouTubeShortsEligibility {
  if (asset.height < asset.width)
    return {
      eligible: false,
      reason: "YouTube Shorts requires a vertical or square render.",
    };
  if (asset.durationMilliseconds > YOUTUBE_SHORTS_MAX_DURATION_MILLISECONDS)
    return {
      eligible: false,
      reason: "YouTube Shorts cannot exceed 3 minutes.",
    };
  return { eligible: true, reason: null };
}
