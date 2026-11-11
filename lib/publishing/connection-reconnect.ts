import type { ContentPlatform } from "@/db/schema";
import { linkedInOrganizationUrnSchema } from "@/lib/publishing/linkedin-account";
import { LINKEDIN_PAGES_AUTHORIZE_PATH } from "@/lib/publishing/linkedin-pages-navigation";

export type ReconnectableConnection = {
  platform: ContentPlatform;
  externalAccountId: string;
  isSandbox?: boolean;
  status: "active" | "expired" | "revoked";
};

export type ReconnectFlags = {
  videoPublishingEnabled: boolean;
  socialPostingEnabled: boolean;
};

/**
 * The OAuth start route that re-authorizes an existing connection, or null when
 * this connection cannot be reconnected from a button.
 *
 * Reconnecting is a fresh authorization through the same route as connecting:
 * the callback upserts on (workspace, platform, external account), so choosing
 * the same account at the provider refreshes this row's tokens and clears its
 * error instead of adding a duplicate.
 *
 * Null when:
 * - the connection is revoked (it is no longer listed; Connect is the action);
 * - it is a TikTok sandbox connection, whose app credentials come from a
 *   separate flow — the production route would replace them;
 * - the deployment flag that gates the platform's authorize route is off, so
 *   the link would 404.
 */
export function getReconnectAuthorizePath(
  connection: ReconnectableConnection,
  flags: ReconnectFlags,
): string | null {
  if (connection.status === "revoked") return null;

  switch (connection.platform) {
    case "youtube":
      return flags.videoPublishingEnabled ? "/api/youtube/authorize" : null;
    case "facebook":
      return flags.videoPublishingEnabled ? "/api/facebook/authorize" : null;
    case "instagram":
      return flags.videoPublishingEnabled ? "/api/instagram/authorize" : null;
    case "tiktok":
      if (connection.isSandbox) return null;
      return flags.videoPublishingEnabled ? "/api/tiktok/authorize" : null;
    case "linkedin":
      if (!flags.socialPostingEnabled) return null;
      return linkedInOrganizationUrnSchema.safeParse(
        connection.externalAccountId,
      ).success
        ? LINKEDIN_PAGES_AUTHORIZE_PATH
        : "/api/linkedin/authorize";
    case "twitter":
      return flags.socialPostingEnabled ? "/api/x/authorize" : null;
    default: {
      const unreachable: never = connection.platform;
      return unreachable;
    }
  }
}
