import type { VerifiedMediaMetadata } from "@/lib/media/media-inspection";
import type { SocialPostPlatform } from "@/lib/social/platform-post-capabilities";

const H264_DESTINATIONS = new Set<SocialPostPlatform>([
  "instagram",
  "tiktok",
  "twitter",
]);

export function checkVerifiedVideoCompatibility(input: {
  platform: SocialPostPlatform;
  metadata: VerifiedMediaMetadata | null;
}): { compatible: true } | { compatible: false; reason: string } {
  if (!input.metadata || input.metadata.kind !== "video")
    return {
      compatible: false,
      reason:
        "Wait for server-side video inspection to finish before using this file.",
    };
  const video = input.metadata;
  if (video.width < 16 || video.height < 16)
    return {
      compatible: false,
      reason: "Transcode the video to dimensions of at least 16×16 pixels.",
    };
  if (H264_DESTINATIONS.has(input.platform) && video.codec !== "h264")
    return {
      compatible: false,
      reason: `${input.platform} requires this upload to be transcoded to H.264 video before scheduling.`,
    };
  if (
    input.platform !== "youtube" &&
    !["mp4", "mov", "matroska", "webm"].includes(video.container)
  )
    return {
      compatible: false,
      reason: `Transcode the ${video.container} container to MP4 before scheduling to ${input.platform}.`,
    };
  return { compatible: true };
}
