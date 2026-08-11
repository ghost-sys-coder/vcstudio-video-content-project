import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildMarketingPublishingConnectionsView } from "@/lib/marketing/integrations/marketing-integrations-view";

describe("marketing integrations publishing connections", () => {
  it("omits disconnected channels and preserves reconnectable expired ones", () => {
    const base = {
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
    const view = buildMarketingPublishingConnectionsView(
      [
        { ...base, id: "active", status: "active" },
        { ...base, id: "expired", status: "expired" },
        { ...base, id: "revoked", status: "revoked" },
      ],
      new Date("2026-08-11T12:00:00.000Z"),
    );

    expect(view.map(({ id }) => id)).toEqual(["active", "expired"]);
  });
});
