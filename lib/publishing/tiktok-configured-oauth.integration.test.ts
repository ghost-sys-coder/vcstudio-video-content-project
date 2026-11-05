import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
  fetch: vi.fn(),
  environment: {
    ENABLE_VIDEO_PUBLISHING: true,
    ENABLE_PUBLISH_SIMULATION: false,
    TIKTOK_API_CLIENT_KEY: "configured-app",
    TIKTOK_API_CLIENT_SECRET: "configured-secret",
    PLATFORM_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
  },
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: mocks.context,
}));
vi.mock("@/db/commands/platform-connection-commands", () => ({
  upsertPlatformConnection: mocks.save,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: mocks.audit,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => mocks.environment,
  getPublishingWebEnvironment: () => ({
    APP_BASE_URL: "https://studio.example",
    OAUTH_STATE_SECRET: "test-signing-key",
    OAUTH_STATE_TTL_SECONDS: 600,
  }),
}));

import { GET as authorize } from "@/app/api/tiktok/authorize/route";
import { GET as callback } from "@/app/api/tiktok/callback/route";
import { createOAuthState, verifyOAuthState } from "./oauth-state";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "owner-1";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.environment.ENABLE_VIDEO_PUBLISHING = true;
  mocks.environment.TIKTOK_API_CLIENT_KEY = "configured-app";
  mocks.environment.TIKTOK_API_CLIENT_SECRET = "configured-secret";
  mocks.context.mockResolvedValue({
    activeMembership: { workspaceId, role: "owner" },
    user: { id: userId },
  });
  mocks.save.mockResolvedValue({ id: "saved-connection" });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

async function authorizationUrl() {
  const response = await authorize();
  expect(response.status).toBe(307);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const location = response.headers.get("location");
  if (!location) throw new Error("Missing authorization redirect");
  return new URL(location);
}

describe("configured TikTok connection through real authorization and callback routes", () => {
  it("starts with server credentials and fresh workspace-bound consent without asking for credentials", async () => {
    const first = await authorizationUrl();
    const second = await authorizationUrl();
    expect(first.origin + first.pathname).toBe(
      "https://www.tiktok.com/v2/auth/authorize/",
    );
    expect(first.searchParams.get("client_key")).toBe("configured-app");
    expect(first.searchParams.get("disable_auto_auth")).toBe("1");
    expect(first.searchParams.get("scope")).toBe(
      "user.info.basic,video.upload",
    );
    expect(first.searchParams.get("redirect_uri")).toBe(
      "https://studio.example/api/tiktok/callback",
    );
    expect(first.toString()).not.toContain("configured-secret");
    expect(first.searchParams.get("state")).not.toBe(
      second.searchParams.get("state"),
    );
    expect(
      verifyOAuthState({
        state: first.searchParams.get("state") ?? "",
        secret: "test-signing-key",
        platform: "tiktok",
        ttlSeconds: 600,
      }),
    ).toMatchObject({ workspaceId, userId, platform: "tiktok" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("exchanges each account's consent using only the configured secret and authenticated workspace", async () => {
    for (const account of ["account-one", "account-two"]) {
      const url = await authorizationUrl();
      mocks.fetch
        .mockResolvedValueOnce(
          Response.json({
            open_id: account,
            scope: "user.info.basic,video.upload",
            access_token: `access-${account}`,
            expires_in: 3600,
            refresh_token: `refresh-${account}`,
            refresh_expires_in: 86400,
            token_type: "Bearer",
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            data: { user: { open_id: account, display_name: account } },
            error: { code: "ok" },
          }),
        );
      const request = new URL("https://studio.example/api/tiktok/callback");
      request.searchParams.set("code", `code-${account}`);
      request.searchParams.set("state", url.searchParams.get("state") ?? "");
      request.searchParams.set("client_secret", "untrusted-browser-value");
      request.searchParams.set("workspaceId", "untrusted-workspace");
      const response = await callback(new Request(request));
      expect(response.headers.get("location")).toBe(
        "https://studio.example/app/social/accounts?tiktok=connected",
      );
      expect(mocks.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workspaceId,
          platform: "tiktok",
          connectedByUserId: userId,
          account: expect.objectContaining({ externalAccountId: account }),
          tokens: expect.objectContaining({
            accessToken: `access-${account}`,
            refreshToken: `refresh-${account}`,
          }),
        }),
      );
    }
    expect(mocks.save).toHaveBeenCalledTimes(2);
    for (const call of [mocks.fetch.mock.calls[0], mocks.fetch.mock.calls[2]]) {
      expect(call[1].body.get("client_key")).toBe("configured-app");
      expect(call[1].body.get("client_secret")).toBe("configured-secret");
    }
  });

  it.each(["editor", "viewer", "missing"])(
    "blocks %s before authorization",
    async (role) => {
      mocks.context.mockResolvedValue(
        role === "missing" ? null : { activeMembership: { workspaceId, role } },
      );
      expect((await authorize()).status).toBe(403);
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );

  it("respects the publishing pause", async () => {
    mocks.environment.ENABLE_VIDEO_PUBLISHING = false;
    expect((await authorize()).status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(["TIKTOK_API_CLIENT_KEY", "TIKTOK_API_CLIENT_SECRET"] as const)(
    "returns missing %s to account feedback without leaking values",
    async (key) => {
      mocks.environment[key] = " ";
      const url = await authorizationUrl();
      expect(url.toString()).toBe(
        "https://studio.example/app/social/accounts?tiktok=failed",
      );
      expect(url.toString()).not.toContain("configured-secret");
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );

  it.each(["changed_workspace", "changed_user", "expired", "tampered"])(
    "rejects %s at callback without exchanging or saving",
    async (scenario) => {
      const url = await authorizationUrl();
      let state = url.searchParams.get("state") ?? "";
      if (scenario === "changed_workspace")
        mocks.context.mockResolvedValue({
          activeMembership: { workspaceId: "other-workspace", role: "owner" },
          user: { id: userId },
        });
      if (scenario === "changed_user")
        mocks.context.mockResolvedValue({
          activeMembership: { workspaceId, role: "owner" },
          user: { id: "another-owner" },
        });
      if (scenario === "expired")
        state = createOAuthState({
          workspaceId,
          userId,
          platform: "tiktok",
          secret: "test-signing-key",
          now: new Date(Date.now() - 601000),
        });
      if (scenario === "tampered") state += "tampered";
      const response = await callback(
        new Request(
          `https://studio.example/api/tiktok/callback?code=code&state=${encodeURIComponent(state)}`,
        ),
      );
      expect(response.headers.get("location")).toMatch(
        /tiktok=(forbidden|failed)/,
      );
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );
});
