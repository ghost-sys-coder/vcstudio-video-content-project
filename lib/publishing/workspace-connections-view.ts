import "server-only";

import type { ContentPlatform } from "@/db/schema";
import {
  listPlatformConnections,
  type PlatformConnectionSummary,
} from "@/db/repositories/publishing.repository";
import { getPublishingEnvironment } from "@/lib/env/server";
import { CONTENT_PLATFORM_LABELS } from "@/lib/titles/title-view";

export type WorkspaceChannelView = {
  id: string;
  platform: ContentPlatform;
  platformLabel: string;
  accountName: string;
  accountUrl: string | null;
  status: "active" | "expired" | "revoked";
  lastError: string | null;
  updatedAtLabel: string;
};

export type WorkspaceChannelPlatformView = {
  platform: ContentPlatform;
  label: string;
  available: boolean;
};

export type WorkspaceChannelsView = {
  enabled: boolean;
  channels: WorkspaceChannelView[];
  platforms: WorkspaceChannelPlatformView[];
};

const PLATFORM_ORDER: readonly ContentPlatform[] = [
  "youtube",
  "facebook",
  "instagram",
  "tiktok",
];

function formatUtc(value: Date): string {
  return `${value.toISOString().slice(0, 10)} UTC`;
}

export function buildWorkspaceChannelsView(input: {
  enabled: boolean;
  connections: PlatformConnectionSummary[];
}): WorkspaceChannelsView {
  return {
    enabled: input.enabled,
    channels: input.connections.map((connection) => ({
      id: connection.id,
      platform: connection.platform,
      platformLabel: CONTENT_PLATFORM_LABELS[connection.platform],
      accountName: connection.externalAccountName,
      accountUrl: connection.externalAccountUrl,
      status: connection.status,
      lastError: connection.lastError,
      updatedAtLabel: formatUtc(connection.updatedAt),
    })),
    platforms: PLATFORM_ORDER.map((platform) => ({
      platform,
      label: CONTENT_PLATFORM_LABELS[platform],
      available: platform === "youtube",
    })),
  };
}

export async function loadWorkspaceChannelsView(input: {
  workspaceId: string;
}): Promise<WorkspaceChannelsView> {
  const [connections, environment] = await Promise.all([
    listPlatformConnections({ workspaceId: input.workspaceId }),
    Promise.resolve(getPublishingEnvironment()),
  ]);
  return buildWorkspaceChannelsView({
    enabled: environment.ENABLE_VIDEO_PUBLISHING,
    connections,
  });
}
