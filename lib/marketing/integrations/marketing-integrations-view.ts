import "server-only";

import type { ContentPlatform } from "@/db/schema";
import { listPlatformConnections } from "@/db/repositories/publishing.repository";
import {
  findGoogleBusinessConnection,
  listGoogleBusinessLocations,
} from "@/db/repositories/google-business.repository";
import {
  getMarketingEnvironment,
  getPublishingEnvironment,
} from "@/lib/env/server";
import { resolveMarketingConnectionHealth } from "@/lib/marketing/integrations/connection-health";
import { CONTENT_PLATFORM_LABELS } from "@/lib/platforms/platform-labels";
import type { PostConnectionView } from "@/lib/social/social-post-view";
import type { PlatformConnectionSummary } from "@/db/repositories/publishing.repository";

export type MarketingProviderStatus = {
  id: string;
  label: string;
  description: string;
  state: "ready" | "setup_required" | "disabled";
  detail: string;
};

export type MarketingIntegrationsView = {
  connections: PostConnectionView[];
  providers: MarketingProviderStatus[];
  googleBusiness: GoogleBusinessIntegrationView;
};

export type GoogleBusinessIntegrationView = {
  connected: boolean;
  status: "active" | "expired" | "revoked" | "not_connected";
  statusLabel: string;
  message: string | null;
  lastError: string | null;
  locations: {
    id: string;
    accountName: string;
    accountDisplayName: string;
    title: string;
    selected: boolean;
    isPrimary: boolean;
  }[];
};

const PLATFORM_ORDER: readonly ContentPlatform[] = [
  "youtube",
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "twitter",
];

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function platformConfigured(platform: ContentPlatform): boolean {
  const environment = getPublishingEnvironment();
  if (environment.ENABLE_SOCIAL_POST_SIMULATION) return true;
  switch (platform) {
    case "youtube":
      return (
        configured(environment.GOOGLE_OAUTH_CLIENT_ID) &&
        configured(environment.GOOGLE_OAUTH_CLIENT_SECRET)
      );
    case "facebook":
      return (
        configured(environment.FACEBOOK_APP_ID) &&
        configured(environment.FACEBOOK_APP_SECRET)
      );
    case "instagram":
      return (
        configured(environment.INSTAGRAM_APP_ID) &&
        configured(environment.INSTAGRAM_APP_SECRET)
      );
    case "tiktok":
      return (
        configured(environment.TIKTOK_API_CLIENT_KEY) &&
        configured(environment.TIKTOK_API_CLIENT_SECRET)
      );
    case "linkedin":
      return (
        configured(environment.LINKEDIN_CLIENT_ID) &&
        configured(environment.LINKEDIN_CLIENT_SECRET)
      );
    case "twitter":
      return (
        configured(environment.TWITTER_CLIENT_ID) &&
        configured(environment.TWITTER_CLIENT_SECRET)
      );
  }
}

function platformProviderStatus(
  platform: ContentPlatform,
): MarketingProviderStatus {
  const environment = getPublishingEnvironment();
  const enabled = environment.ENABLE_SOCIAL_POSTING;
  const ready = platformConfigured(platform);
  return {
    id: `social-${platform}`,
    label: CONTENT_PLATFORM_LABELS[platform],
    description: "OAuth connection and social publishing",
    state: !enabled ? "disabled" : ready ? "ready" : "setup_required",
    detail: !enabled
      ? "Social posting is disabled for this deployment."
      : ready
        ? "Server credentials are configured."
        : "Server credentials are missing.",
  };
}

export function buildMarketingPublishingConnectionsView(
  connections: PlatformConnectionSummary[],
  now: Date,
): PostConnectionView[] {
  return connections
    .filter((connection) => connection.status !== "revoked")
    .map((connection) => ({
      id: connection.id,
      platform: connection.platform,
      platformLabel: CONTENT_PLATFORM_LABELS[connection.platform],
      accountName: connection.externalAccountName,
      status: resolveMarketingConnectionHealth(connection, now),
    }));
}

export async function loadMarketingIntegrationsView(input: {
  workspaceId: string;
  now?: Date;
  googleBusinessMessage?: string | null;
}): Promise<MarketingIntegrationsView> {
  const now = input.now ?? new Date();
  const [connections, marketingEnvironment, googleConnection, googleLocations] =
    await Promise.all([
      listPlatformConnections({ workspaceId: input.workspaceId }),
      Promise.resolve(getMarketingEnvironment()),
      findGoogleBusinessConnection({ workspaceId: input.workspaceId }),
      listGoogleBusinessLocations({ workspaceId: input.workspaceId }),
    ]);
  const researchProvider = marketingEnvironment.MARKETING_RESEARCH_PROVIDER;
  const researchReady =
    researchProvider === "tavily" &&
    configured(marketingEnvironment.TAVILY_API_KEY);
  const publishingEnvironment = getPublishingEnvironment();
  const googleBusinessScope =
    publishingEnvironment.GOOGLE_BUSINESS_SCOPE ??
    publishingEnvironment.GOOGLE_BUSINESS_SCOPES;
  const googleBusinessReady =
    configured(publishingEnvironment.GOOGLE_OAUTH_CLIENT_ID) &&
    configured(publishingEnvironment.GOOGLE_OAUTH_CLIENT_SECRET) &&
    Boolean(
      googleBusinessScope
        ?.split(/\s+/)
        .includes("https://www.googleapis.com/auth/business.manage"),
    );

  return {
    connections: buildMarketingPublishingConnectionsView(connections, now),
    providers: [
      ...PLATFORM_ORDER.map(platformProviderStatus),
      {
        id: "google-business",
        label: "Google Business Profile",
        description: "Business location discovery and AI grounding",
        state: googleBusinessReady ? "ready" : "setup_required",
        detail: googleBusinessReady
          ? "OAuth credentials and the business.manage scope are configured."
          : "Google OAuth credentials or the Business Profile scope are missing.",
      },
      {
        id: "research",
        label: "Web research",
        description: "Cited competitor and trend research",
        state:
          researchProvider === "none"
            ? "disabled"
            : researchReady
              ? "ready"
              : "setup_required",
        detail:
          researchProvider === "none"
            ? "Web research is disabled for this deployment."
            : researchReady
              ? "Tavily is configured."
              : `${researchProvider} is selected but not configured.`,
      },
    ],
    googleBusiness: {
      connected:
        googleConnection?.status !== "revoked" && Boolean(googleConnection),
      status: googleConnection?.status ?? "not_connected",
      statusLabel:
        googleConnection?.status === "active"
          ? googleConnection.syncStatus === "failed"
            ? "Needs attention"
            : "Connected"
          : googleConnection?.status === "expired"
            ? "Reconnect required"
            : googleConnection?.status === "revoked"
              ? "Disconnected"
              : "Not connected",
      message: input.googleBusinessMessage ?? null,
      lastError: googleConnection?.lastError ?? null,
      locations: googleLocations.map((location) => ({
        id: location.id,
        accountName: location.accountName,
        accountDisplayName: location.accountDisplayName,
        title: location.title,
        selected: location.selected,
        isPrimary: location.isPrimary,
      })),
    },
  };
}
