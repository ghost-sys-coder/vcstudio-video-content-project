import "server-only";

import type { ContentPlatform } from "@/db/schema";
import { getPublishingEnvironment } from "@/lib/env/server";
import {
  createVideoPublishProvider,
  isPlatformConfigured,
  PlatformNotConfiguredError,
  UnsupportedPlatformError,
} from "@/lib/publishing/provider-registry";
import { FacebookSocialPostProvider } from "@/lib/publishing/providers/facebook-social-post-provider";
import { InstagramSocialPostProvider } from "@/lib/publishing/providers/instagram-social-post-provider";
import { LinkedInOAuthProvider } from "@/lib/publishing/providers/linkedin-oauth-provider";
import { LinkedInSocialPostProvider } from "@/lib/publishing/providers/linkedin-social-post-provider";
import { SimulatedSocialPostProvider } from "@/lib/publishing/providers/simulated-social-post-provider";
import { TikTokSocialPostProvider } from "@/lib/publishing/providers/tiktok-social-post-provider";
import { YouTubeSocialPostProvider } from "@/lib/publishing/providers/youtube-social-post-provider";
import type { PlatformOAuthProvider } from "@/lib/publishing/platform-oauth-provider";
import type { SocialPostProvider } from "@/lib/publishing/social-post-provider";
import {
  isSocialPostPlatform,
  type SocialPostPlatform,
} from "@/lib/social/platform-post-capabilities";

function requireCredential(
  value: string | undefined,
  platform: ContentPlatform,
): string {
  if (!value || value.trim() === "")
    throw new PlatformNotConfiguredError(platform);
  return value;
}

/**
 * Whether a platform's server-side credentials are present for social posting.
 *
 * LinkedIn adds a credential requirement the video path never had; the other
 * four reuse exactly the same configuration they already use for publishing a
 * render, so this defers to that check.
 */
export function isSocialPostPlatformConfigured(
  platform: ContentPlatform,
): boolean {
  const environment = getPublishingEnvironment();
  if (environment.ENABLE_SOCIAL_POST_SIMULATION) return true;
  if (platform === "linkedin")
    return (
      Boolean(environment.LINKEDIN_CLIENT_ID?.trim()) &&
      Boolean(environment.LINKEDIN_CLIENT_SECRET?.trim())
    );
  return isPlatformConfigured(platform);
}

/**
 * The OAuth half of a platform integration, for the connect/callback routes.
 *
 * The four existing platforms reuse their video provider, which already
 * implements `PlatformOAuthProvider`; LinkedIn gets its own, because it has no
 * video-publishing implementation.
 */
export function createPlatformOAuthProvider(
  platform: ContentPlatform,
): PlatformOAuthProvider {
  if (platform === "linkedin") {
    const environment = getPublishingEnvironment();
    return new LinkedInOAuthProvider({
      clientId: requireCredential(environment.LINKEDIN_CLIENT_ID, platform),
      clientSecret: requireCredential(
        environment.LINKEDIN_CLIENT_SECRET,
        platform,
      ),
    });
  }
  return createVideoPublishProvider(platform);
}

export function createSocialPostProvider(
  platform: ContentPlatform,
): SocialPostProvider {
  if (!isSocialPostPlatform(platform))
    throw new UnsupportedPlatformError(platform);

  const environment = getPublishingEnvironment();
  if (environment.ENABLE_SOCIAL_POST_SIMULATION)
    return new SimulatedSocialPostProvider({
      platform,
      stepDelayMs: environment.PUBLISH_SIMULATION_STEP_MS,
    });

  const narrowed: SocialPostPlatform = platform;
  switch (narrowed) {
    case "linkedin":
      return new LinkedInSocialPostProvider({
        apiVersion: environment.LINKEDIN_API_VERSION,
      });
    case "facebook":
      return new FacebookSocialPostProvider({
        apiVersion: environment.FACEBOOK_GRAPH_API_VERSION,
        videoProvider: createVideoPublishProvider("facebook"),
      });
    case "instagram":
      return new InstagramSocialPostProvider({
        apiVersion: environment.INSTAGRAM_GRAPH_API_VERSION,
        videoProvider: createVideoPublishProvider("instagram"),
      });
    case "tiktok":
      return new TikTokSocialPostProvider(createVideoPublishProvider("tiktok"));
    case "youtube":
      return new YouTubeSocialPostProvider(
        createVideoPublishProvider("youtube"),
      );
    default: {
      // Exhaustiveness guard: a new postable platform must be handled here.
      const unreachable: never = narrowed;
      throw new UnsupportedPlatformError(String(unreachable));
    }
  }
}
