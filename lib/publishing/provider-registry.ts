import "server-only";

import type { ContentPlatform } from "@/db/schema";
import {
  getPublishingEnvironment,
  getPublishingWebEnvironment,
} from "@/lib/env/server";
import { YouTubeVideoPublishProvider } from "@/lib/publishing/providers/youtube-video-publish-provider";
import { FacebookVideoPublishProvider } from "@/lib/publishing/providers/facebook-video-publish-provider";
import { InstagramVideoPublishProvider } from "@/lib/publishing/providers/instagram-video-publish-provider";
import { TikTokVideoUploadProvider } from "@/lib/publishing/providers/tiktok-video-upload-provider";
import { SimulatedVideoPublishProvider } from "@/lib/publishing/providers/simulated-video-publish-provider";
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
  "instagram",
  "tiktok",
];

export function isPublishablePlatform(platform: ContentPlatform): boolean {
  return PUBLISHABLE_PLATFORMS.includes(platform);
}

export function createVideoPublishProvider(
  platform: ContentPlatform,
): VideoPublishProvider {
  const environment = getPublishingEnvironment();
  // Testing/demo: one simulator stands in for every platform, so the publish
  // flow completes without any real API call. Off in production.
  if (environment.ENABLE_PUBLISH_SIMULATION)
    return new SimulatedVideoPublishProvider({
      platform,
      stepDelayMs: environment.PUBLISH_SIMULATION_STEP_MS,
    });
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
      return new InstagramVideoPublishProvider({
        apiVersion: environment.INSTAGRAM_GRAPH_API_VERSION,
      });
    case "tiktok":
      return new TikTokVideoUploadProvider({
        clientKey: environment.TIKTOK_API_CLIENT_KEY,
        clientSecret: environment.TIKTOK_API_CLIENT_SECRET,
      });
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
