import "server-only";

import type { ContentPlatform } from "@/db/schema";
import { listPlatformConnections } from "@/db/repositories/publishing.repository";
import {
  getMarketingEnvironment,
  getPublishingEnvironment,
} from "@/lib/env/server";
import { resolveMarketingConnectionHealth } from "@/lib/marketing/integrations/connection-health";
import { CONTENT_PLATFORM_LABELS } from "@/lib/platforms/platform-labels";
import type { PostConnectionView } from "@/lib/social/social-post-view";

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

export async function loadMarketingIntegrationsView(input: {
  workspaceId: string;
  now?: Date;
}): Promise<MarketingIntegrationsView> {
  const now = input.now ?? new Date();
  const [connections, marketingEnvironment] = await Promise.all([
    listPlatformConnections({ workspaceId: input.workspaceId }),
    Promise.resolve(getMarketingEnvironment()),
  ]);
  const researchProvider = marketingEnvironment.MARKETING_RESEARCH_PROVIDER;
  const researchReady =
    researchProvider === "tavily" &&
    configured(marketingEnvironment.TAVILY_API_KEY);

  return {
    connections: connections.map((connection) => ({
      id: connection.id,
      platform: connection.platform,
      platformLabel: CONTENT_PLATFORM_LABELS[connection.platform],
      accountName: connection.externalAccountName,
      status: resolveMarketingConnectionHealth(connection, now),
    })),
    providers: [
      ...PLATFORM_ORDER.map(platformProviderStatus),
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
  };
}
