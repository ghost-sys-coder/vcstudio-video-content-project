import { Music2Icon } from "lucide-react";
import { FacebookMarkIcon } from "@/components/brand/FacebookMarkIcon";
import { InstagramMarkIcon } from "@/components/brand/InstagramMarkIcon";
import { LinkedInMarkIcon } from "@/components/brand/LinkedInMarkIcon";
import { YouTubeMarkIcon } from "@/components/brand/YouTubeMarkIcon";
import type { ContentPlatform } from "@/db/schema";

/**
 * The brand mark for a connected platform.
 *
 * Exhaustive rather than a chain ending in a default: an unlisted platform used
 * to fall through to the YouTube mark, so LinkedIn shipped wearing YouTube's
 * logo. The `never` guard makes the next platform a compile error instead.
 */
export function PlatformMarkIcon({
  className,
  platform,
}: {
  className?: string;
  platform: ContentPlatform;
}) {
  switch (platform) {
    case "youtube":
      return <YouTubeMarkIcon className={className} />;
    case "facebook":
      return <FacebookMarkIcon className={className} />;
    case "instagram":
      return <InstagramMarkIcon className={className} />;
    case "linkedin":
      return <LinkedInMarkIcon className={className} />;
    case "tiktok":
      // TikTok's note mark is not redistributable the way the others are, so the
      // generic music glyph stands in — as it already did before this component.
      return <Music2Icon aria-hidden className={className} />;
    default: {
      const unreachable: never = platform;
      throw new Error(`Unhandled platform: ${String(unreachable)}`);
    }
  }
}
