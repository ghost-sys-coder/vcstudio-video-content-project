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
        postingRequirement: "Needs one video.",
        reconnectPath: "/api/youtube/authorize",
      },
    ]);
    expect(view.channels[0]).not.toHaveProperty("accessTokenSealed");
  });

  it("offers reconnect only where the platform's authorize route is enabled", () => {
    const base = {
      workspaceId: "workspace-1",
      externalAccountUrl: null,
      status: "expired" as const,
      lastError: "Authorization expired.",
      accessTokenExpiresAt: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-11T00:00:00.000Z"),
    };
    const view = buildWorkspaceChannelsView({
      enabled: false,
      socialPostingEnabled: true,
      connections: [
        {
          ...base,
          id: "youtube",
          platform: "youtube",
          externalAccountId: "channel-1",
          externalAccountName: "Channel",
        },
        {
          ...base,
          id: "page",
          platform: "linkedin",
          externalAccountId: "urn:li:organization:7",
          externalAccountName: "Studio Page",
        },
        {
          ...base,
          id: "sandbox",
          platform: "tiktok",
          isSandbox: true,
          externalAccountId: "open-id",
          externalAccountName: "Sandbox creator",
        },
      ],
    });

    expect(
      Object.fromEntries(
        view.channels.map(({ id, reconnectPath }) => [id, reconnectPath]),
      ),
    ).toEqual({
      youtube: null,
      page: "/api/linkedin/pages/authorize",
      sandbox: null,
    });
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
