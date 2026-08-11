import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildWorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";

describe("workspace channels view", () => {
  it("maps workspace connections without exposing credentials", () => {
    const view = buildWorkspaceChannelsView({
      enabled: true,
      socialPostingEnabled: true,
      connections: [
        {
          id: "connection-1",
          workspaceId: "workspace-1",
          platform: "youtube",
          externalAccountId: "channel-1",
          externalAccountName: "VCStudio",
          externalAccountUrl: "https://www.youtube.com/channel/channel-1",
          status: "active",
          lastError: null,
          accessTokenExpiresAt: null,
          createdAt: new Date("2026-07-20T00:00:00.000Z"),
          updatedAt: new Date("2026-07-22T00:00:00.000Z"),
        },
      ],
    });

    expect(view.channels).toEqual([
      {
        id: "connection-1",
        platform: "youtube",
        platformLabel: "YouTube",
        accountName: "VCStudio",
        accountUrl: "https://www.youtube.com/channel/channel-1",
        status: "active",
        lastError: null,
        updatedAtLabel: "2026-07-22 UTC",
      },
    ]);
    expect(view.channels[0]).not.toHaveProperty("accessTokenSealed");
  });

  it("exposes implemented platforms as connectable", () => {
    const view = buildWorkspaceChannelsView({
      enabled: true,
      socialPostingEnabled: true,
      connections: [],
    });

    expect(view.platforms).toEqual([
      { platform: "youtube", label: "YouTube", available: true },
      { platform: "facebook", label: "Facebook", available: true },
      { platform: "instagram", label: "Instagram", available: true },
      { platform: "tiktok", label: "TikTok", available: true },
      { platform: "linkedin", label: "LinkedIn", available: true },
      { platform: "twitter", label: "X", available: true },
    ]);
  });

  it("omits disconnected channels while retaining expired connections", () => {
    const connection = {
      id: "connection-active",
      workspaceId: "workspace-1",
      platform: "youtube" as const,
      externalAccountId: "channel-1",
      externalAccountName: "VCStudio",
      externalAccountUrl: null,
      lastError: null,
      accessTokenExpiresAt: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-11T00:00:00.000Z"),
    };
    const view = buildWorkspaceChannelsView({
      enabled: true,
      socialPostingEnabled: true,
      connections: [
        { ...connection, id: "expired", status: "expired" },
        { ...connection, id: "revoked", status: "revoked" },
      ],
    });

    expect(view.channels.map(({ id }) => id)).toEqual(["expired"]);
  });
});
