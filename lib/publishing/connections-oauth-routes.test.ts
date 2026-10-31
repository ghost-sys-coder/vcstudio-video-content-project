import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  exchange: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
  verify: vi.fn(),
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
vi.mock("@/lib/publishing/oauth-state", () => ({
  verifyOAuthState: mocks.verify,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({
    ENABLE_VIDEO_PUBLISHING: true,
    ENABLE_SOCIAL_POSTING: true,
  }),
  getPublishingWebEnvironment: () => ({
    APP_BASE_URL: "https://studio.example",
  }),
}));
vi.mock("@/lib/publishing/provider-registry", () => ({
  createRedirectUri: (platform: string) =>
    `https://studio.example/api/${platform}/callback`,
  createVideoPublishProvider: () => ({ exchangeCode: mocks.exchange }),
}));
vi.mock("@/lib/publishing/social-post-registry", () => ({
  createPlatformOAuthProvider: () => ({ exchangeCode: mocks.exchange }),
}));
vi.mock("@/lib/publishing/providers/instagram-video-publish-provider", () => ({
  InstagramVideoPublishProvider: class {
    exchangeCode = mocks.exchange;
  },
}));
vi.mock("@/lib/publishing/providers/facebook-video-publish-provider", () => ({
  FacebookVideoPublishProvider: class {
    exchangeUserToken = mocks.exchange;
  },
}));
vi.mock("@/lib/publishing/facebook-oauth-session", () => ({
  FACEBOOK_OAUTH_SESSION_COOKIE: "facebook-selection",
  createFacebookOAuthSession: () => "test-session",
}));

import { GET as youtube } from "@/app/api/youtube/callback/route";
import { GET as facebook } from "@/app/api/facebook/callback/route";
import { GET as instagram } from "@/app/api/instagram/callback/route";
import { GET as tiktok } from "@/app/api/tiktok/callback/route";
import { GET as linkedin } from "@/app/api/linkedin/callback/route";
import { GET as x } from "@/app/api/x/callback/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    activeMembership: { workspaceId: "workspace-1", role: "owner" },
    user: { id: "user-1" },
  });
  mocks.verify.mockReturnValue({
    workspaceId: "workspace-1",
    userId: "user-1",
  });
  mocks.exchange.mockResolvedValue({ tokens: {}, account: {}, scopes: "" });
  mocks.save.mockResolvedValue({ id: "connection-1" });
});

describe.each([
  { platform: "youtube", GET: youtube },
  { platform: "facebook", GET: facebook },
  { platform: "instagram", GET: instagram },
  { platform: "tiktok", GET: tiktok },
  { platform: "linkedin", GET: linkedin },
  { platform: "x", GET: x },
])("$platform connection OAuth", ({ platform, GET }) => {
  it.each([
    ["", "invalid"],
    ["?error=access_denied", "cancelled"],
  ])("returns %s to the shared accounts page", async (query, status) => {
    const response = await GET(
      new Request(`https://studio.example/api/${platform}/callback${query}`),
    );
    expect(response.headers.get("location")).toBe(
      `https://studio.example/app/social/accounts?${platform}=${status}`,
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("rejects editor connection attempts before contacting a provider", async () => {
    mocks.context.mockResolvedValue({ activeMembership: { role: "editor" } });
    const response = await GET(
      new Request(
        `https://studio.example/api/${platform}/callback?code=test&state=test`,
      ),
    );
    expect(response.headers.get("location")).toBe(
      `https://studio.example/app/social/accounts?${platform}=forbidden`,
    );
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("returns owners to accounts after consent, preserving Facebook page selection", async () => {
    const response = await GET(
      new Request(
        `https://studio.example/api/${platform}/callback?code=test&state=test`,
      ),
    );
    expect(response.headers.get("location")).toBe(
      platform === "facebook"
        ? "https://studio.example/app/settings/workspace/facebook/select"
        : `https://studio.example/app/social/accounts?${platform}=connected`,
    );
    expect(mocks.exchange).toHaveBeenCalledOnce();
  });
});
