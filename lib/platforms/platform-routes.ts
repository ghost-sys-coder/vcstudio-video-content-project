import type { ContentPlatform } from "@/db/schema";

/**
 * URL segment each platform's OAuth routes live under.
 *
 * Almost always the platform id, but the two are not the same thing and cannot
 * be assumed to be: the redirect URI is registered in the *platform's* developer
 * console, and a mismatch is rejected outright at the consent screen rather than
 * failing somewhere debuggable. X is stored as `twitter` (its credentials,
 * scopes, and token endpoints all still say so) while its routes and registered
 * callback say `x`, so the mapping is explicit and exhaustive — a new platform
 * has to state where its routes live instead of inheriting a guess.
 *
 * Client-safe on purpose: connect links render in the browser, and the server
 * module that derives redirect URIs reads the same record, so the authorize link
 * a user clicks and the callback URI sent to the platform can never drift apart.
 */
export const PLATFORM_ROUTE_SEGMENTS: Record<ContentPlatform, string> = {
  youtube: "youtube",
  facebook: "facebook",
  instagram: "instagram",
  tiktok: "tiktok",
  linkedin: "linkedin",
  twitter: "x",
};

export function createPlatformAuthorizePath(platform: ContentPlatform): string {
  return `/api/${PLATFORM_ROUTE_SEGMENTS[platform]}/authorize`;
}

export function createPlatformCallbackPath(platform: ContentPlatform): string {
  return `/api/${PLATFORM_ROUTE_SEGMENTS[platform]}/callback`;
}
