import type { ContentPlatform } from "@/db/schema";

/**
 * The platforms the **video production pipeline** generates content for: script
 * guidance, titles and descriptions, thumbnails, and render publishing.
 *
 * `content_platform` is deliberately wider than this. LinkedIn is a valid
 * destination for a social post but is not somewhere this pipeline writes a
 * video script or renders a thumbnail for, so it is excluded here rather than
 * excluded from the enum — the same pattern as `PUBLISHABLE_PLATFORMS` in
 * `lib/publishing/provider-registry.ts`.
 *
 * Features must iterate and narrow through this list rather than through
 * `contentPlatformEnum.enumValues`, so adding another post-only destination
 * later cannot silently grow a thumbnail tab or an idea platform.
 */
export const VIDEO_CONTENT_PLATFORMS = [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
] as const;

export type VideoContentPlatform = (typeof VIDEO_CONTENT_PLATFORMS)[number];

export function isVideoContentPlatform(
  platform: ContentPlatform,
): platform is VideoContentPlatform {
  return (VIDEO_CONTENT_PLATFORMS as readonly ContentPlatform[]).includes(
    platform,
  );
}

/**
 * Narrows a stored platform for the video pipeline.
 *
 * The fallback is unreachable through the application today: every form that
 * writes a platform onto a brief, a title run, or a thumbnail validates against
 * a Zod enum of exactly these four values, so a stored row can only hold one of
 * them. It exists because the database column is wider than those forms, and
 * because falling back to the most general set of video guidance is a better
 * failure than throwing inside a page render or a cost estimate.
 */
export function toVideoContentPlatform(
  platform: ContentPlatform,
): VideoContentPlatform {
  return isVideoContentPlatform(platform) ? platform : "youtube";
}
