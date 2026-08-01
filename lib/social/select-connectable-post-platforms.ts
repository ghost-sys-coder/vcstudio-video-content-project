import type { ContentPlatform } from "@/db/schema";
import { CONTENT_PLATFORM_LABELS } from "@/lib/platforms/platform-labels";
import { createPlatformAuthorizePath } from "@/lib/platforms/platform-routes";

export type ConnectablePostPlatform = {
  platform: ContentPlatform;
  label: string;
  href: string;
};

/**
 * The destinations that accept **posts but not rendered-video uploads**.
 *
 * These are the two platforms with no `VideoPublishProvider`, so they never
 * appear in the video channel picker and would otherwise be connectable only
 * from workspace settings — which is how a connectable account goes unnoticed.
 * Kept separate from `SOCIAL_POST_PLATFORMS`, which includes the four platforms
 * that are already offered by the video publishing flow; offering those a second
 * time as "connect" links would give the same account two front doors.
 */
export const POST_ONLY_PLATFORMS: readonly ContentPlatform[] = [
  "linkedin",
  "twitter",
];

/**
 * Post-only platforms this workspace has not connected yet.
 *
 * Filtering rather than always showing both keeps the connect row honest: a
 * standing "Connect LinkedIn" next to an already-connected LinkedIn account is
 * read as a broken connection, not as an invitation to add a second one.
 */
export function selectConnectablePostPlatforms(
  connectedPlatforms: readonly ContentPlatform[],
): ConnectablePostPlatform[] {
  return POST_ONLY_PLATFORMS.filter(
    (platform) => !connectedPlatforms.includes(platform),
  ).map((platform) => ({
    platform,
    label: CONTENT_PLATFORM_LABELS[platform],
    href: createPlatformAuthorizePath(platform),
  }));
}
