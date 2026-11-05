import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
  fetch: vi.fn(),
  environment: {
    ENABLE_VIDEO_PUBLISHING: true,
    PLATFORM_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }),
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
import {
  startTikTokSandboxConnectionAction,
  loadTikTokConnectionSetupAction,
} from "@/app/(authenticated)/app/social/accounts/tiktok-actions";
import { GET } from "@/app/api/tiktok/callback/route";
import { TIKTOK_OAUTH_SESSION_COOKIE } from "./tiktok-oauth-session";

const workspaceId = "11111111-1111-4111-8111-111111111111";
function form() {
  const value = new FormData();
  value.set("clientKey", "sandbox-app");
  value.set("clientSecret", "sandbox-secret");
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.environment.ENABLE_VIDEO_PUBLISHING = true;
  mocks.context.mockResolvedValue({
    activeMembership: { workspaceId, role: "owner" },
    user: { id: "owner-1" },
  });
  mocks.save.mockResolvedValue({ id: "saved-connection" });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("owner sandbox start and callback with real OAuth provider", () => {
  it("reports a failed provider exchange safely and clears the browser session", async () => {
    const result = await startTikTokSandboxConnectionAction(form());
    if (!result.ok) throw new Error(result.error);
    const state = new URL(result.authorizationUrl).searchParams.get("state")!;
    mocks.cookieGet.mockReturnValue({
      value: mocks.cookieSet.mock.calls[0][1],
    });
    mocks.fetch.mockResolvedValueOnce(
      Response.json(
        { error: "invalid_client", error_description: "sandbox-secret" },
        { status: 400 },
      ),
    );
    const response = await GET(
      new Request(
        `https://studio.example/api/tiktok/callback?code=code&state=${encodeURIComponent(state)}`,
      ),
    );
    expect(response.headers.get("location")).toBe(
      "https://studio.example/app/social/accounts?tiktok=failed",
    );
    expect(response.cookies.get(TIKTOK_OAUTH_SESSION_COOKIE)?.value).toBe("");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(response.headers.get("location")).not.toContain("sandbox-secret");
  });
  it.each(["editor", "viewer", "missing"])(
    "rejects %s before setting a credential cookie",
    async (role) => {
      mocks.context.mockResolvedValue(
        role === "missing" ? null : { activeMembership: { workspaceId, role } },
      );
      expect((await startTikTokSandboxConnectionAction(form())).ok).toBe(false);
      expect((await loadTikTokConnectionSetupAction()).ok).toBe(false);
      expect(mocks.cookieSet).not.toHaveBeenCalled();
    },
  );
  it("checks feature flags and validates credentials before starting", async () => {
    mocks.environment.ENABLE_VIDEO_PUBLISHING = false;
    expect((await startTikTokSandboxConnectionAction(form())).ok).toBe(false);
    mocks.environment.ENABLE_VIDEO_PUBLISHING = true;
    expect((await startTikTokSandboxConnectionAction(new FormData())).ok).toBe(
      false,
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
  it("uses sandbox credentials, an exact callback and a secure short-lived encrypted cookie", async () => {
    expect(await loadTikTokConnectionSetupAction()).toEqual({
      ok: true,
      redirectUri: "https://studio.example/api/tiktok/callback",
    });
    const result = await startTikTokSandboxConnectionAction(form());
    if (!result.ok) throw new Error(result.error);
    const url = new URL(result.authorizationUrl);
    expect(url.origin).toBe("https://www.tiktok.com");
    expect(url.searchParams.get("client_key")).toBe("sandbox-app");
    expect(url.searchParams.get("disable_auto_auth")).toBe("1");
    expect(url.searchParams.get("scope")).toBe("user.info.basic,video.upload");
    expect(result.authorizationUrl).not.toContain("sandbox-secret");
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      TIKTOK_OAUTH_SESSION_COOKIE,
      expect.not.stringContaining("sandbox-secret"),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/tiktok",
        maxAge: 600,
      }),
    );
    mocks.cookieGet.mockReturnValue({
      value: mocks.cookieSet.mock.calls[0][1],
    });
    mocks.fetch
      .mockResolvedValueOnce(
        Response.json({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          refresh_expires_in: 86400,
          open_id: "target-account",
          scope: "user.info.basic,video.upload",
          token_type: "Bearer",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            user: {
              open_id: "target-account",
              display_name: "My target account",
            },
          },
          error: { code: "ok", message: "", log_id: "test" },
        }),
      );
    const response = await GET(
      new Request(
        `https://studio.example/api/tiktok/callback?code=code&state=${encodeURIComponent(url.searchParams.get("state")!)}`,
      ),
    );
    expect(response.headers.get("location")).toContain("tiktok=connected");
    expect(mocks.fetch.mock.calls[0][1].body.get("client_secret")).toBe(
      "sandbox-secret",
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        platform: "tiktok",
        tikTokSandboxCredentials: {
          clientKey: "sandbox-app",
          clientSecret: "sandbox-secret",
        },
        account: expect.objectContaining({
          externalAccountId: "target-account",
        }),
      }),
    );
    expect(response.cookies.get(TIKTOK_OAUTH_SESSION_COOKIE)?.value).toBe("");
  });
  it.each([
    "missing_cookie",
    "changed_workspace",
    "changed_user",
    "changed_state",
  ])(
    "blocks %s without falling back to production credentials",
    async (problem) => {
      const result = await startTikTokSandboxConnectionAction(form());
      if (!result.ok) throw new Error(result.error);
      const state = new URL(result.authorizationUrl).searchParams.get("state")!;
      mocks.cookieGet.mockReturnValue(
        problem === "missing_cookie"
          ? undefined
          : { value: mocks.cookieSet.mock.calls[0][1] },
      );
      if (problem === "changed_workspace")
        mocks.context.mockResolvedValue({
          activeMembership: {
            workspaceId: "22222222-2222-4222-8222-222222222222",
            role: "owner",
          },
          user: { id: "owner-1" },
        });
      if (problem === "changed_user")
        mocks.context.mockResolvedValue({
          activeMembership: { workspaceId, role: "owner" },
          user: { id: "owner-2" },
        });
      const response = await GET(
        new Request(
          `https://studio.example/api/tiktok/callback?code=code&state=${encodeURIComponent(problem === "changed_state" ? state + "tampered" : state)}`,
        ),
      );
      expect(response.headers.get("location")).toMatch(
        /tiktok=(failed|forbidden)/,
      );
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
    },
  );
});
