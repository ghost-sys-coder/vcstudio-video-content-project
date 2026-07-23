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
 * Thrown when a platform is publishable in principle but its server-side app
 * credentials are not configured in this environment. Kept distinct from a
 * generic error so the task can classify it as non-retriable and surface an
 * actionable, non-secret message instead of hanging or retrying pointlessly.
 */
export class PlatformNotConfiguredError extends Error {
  readonly platform: ContentPlatform;

  constructor(platform: ContentPlatform) {
    super(
      `${PLATFORM_DISPLAY_NAMES[platform]} publishing isn't configured on the server yet.`,
    );
    this.name = "PlatformNotConfiguredError";
    this.platform = platform;
  }
}

const PLATFORM_DISPLAY_NAMES: Record<ContentPlatform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

function requireCredential(
  value: string | undefined,
  platform: ContentPlatform,
): string {
  if (!value || value.trim() === "")
    throw new PlatformNotConfiguredError(platform);
  return value;
}

/**
 * Whether a platform's server-side credentials are present, so callers can
 * pre-flight before creating a publication (giving immediate feedback instead of
 * a queued → failed round trip). Facebook/Instagram need no app-level secret
 * beyond the connected page token, so they are always configured. In simulation
 * mode every platform is "configured" (the simulator needs no real credentials).
 */
export function isPlatformConfigured(platform: ContentPlatform): boolean {
  const environment = getPublishingEnvironment();
  if (environment.ENABLE_PUBLISH_SIMULATION) return true;
  switch (platform) {
    case "youtube":
      return (
        Boolean(environment.GOOGLE_OAUTH_CLIENT_ID?.trim()) &&
        Boolean(environment.GOOGLE_OAUTH_CLIENT_SECRET?.trim())
      );
    case "tiktok":
      return (
        Boolean(environment.TIKTOK_API_CLIENT_KEY?.trim()) &&
        Boolean(environment.TIKTOK_API_CLIENT_SECRET?.trim())
      );
    case "facebook":
    case "instagram":
      return true;
    default:
      return false;
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
        clientId: requireCredential(
          environment.GOOGLE_OAUTH_CLIENT_ID,
          platform,
        ),
        clientSecret: requireCredential(
          environment.GOOGLE_OAUTH_CLIENT_SECRET,
          platform,
        ),
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
        clientKey: requireCredential(
          environment.TIKTOK_API_CLIENT_KEY,
          platform,
        ),
        clientSecret: requireCredential(
          environment.TIKTOK_API_CLIENT_SECRET,
          platform,
        ),
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
