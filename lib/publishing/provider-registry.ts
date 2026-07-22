import "server-only";

import type { ContentPlatform } from "@/db/schema";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { YouTubeVideoPublishProvider } from "@/lib/publishing/providers/youtube-video-publish-provider";
import { FacebookVideoPublishProvider } from "@/lib/publishing/providers/facebook-video-publish-provider";
import type { VideoPublishProvider } from "@/lib/publishing/video-publish-provider";

export class UnsupportedPlatformError extends Error {
  constructor(platform: string) {
    super(`Publishing to ${platform} is not available yet.`);
    this.name = "UnsupportedPlatformError";
  }
}

/**
 * Platforms that can currently be published to. Facebook, Instagram, and TikTok
 * are already valid `content_platform` values (briefs, titles, and thumbnails
 * support all four), so this list — not the enum — is what gates publishing.
 * Adding a platform means implementing `VideoPublishProvider` and adding a case
 * to `createVideoPublishProvider`.
 */
export const PUBLISHABLE_PLATFORMS: readonly ContentPlatform[] = [
  "youtube",
  "facebook",
];

export function isPublishablePlatform(platform: ContentPlatform): boolean {
  return PUBLISHABLE_PLATFORMS.includes(platform);
}

export function createVideoPublishProvider(
  platform: ContentPlatform,
): VideoPublishProvider {
  const environment = getPublishingEnvironment();
  switch (platform) {
    case "youtube":
      return new YouTubeVideoPublishProvider({
        clientId: environment.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: environment.GOOGLE_OAUTH_CLIENT_SECRET,
      });
    case "facebook":
      return new FacebookVideoPublishProvider({
        apiVersion: environment.FACEBOOK_GRAPH_API_VERSION,
      });
    case "instagram":
    case "tiktok":
      throw new UnsupportedPlatformError(platform);
    default: {
      // Exhaustiveness guard: a new content_platform value must be handled here.
      const unreachable: never = platform;
      throw new UnsupportedPlatformError(String(unreachable));
    }
  }
}

/**
 * Redirect URI for a platform's OAuth callback, derived from the app origin.
 * Web-runtime only — resolved lazily so the worker, which imports this module
 * for `createVideoPublishProvider`, never parses the web-only environment.
 */
export function createRedirectUri(platform: ContentPlatform): string {
  const { APP_BASE_URL } = getPublishingWebEnvironment();
  return new URL(`/api/${platform}/callback`, APP_BASE_URL).toString();
}
