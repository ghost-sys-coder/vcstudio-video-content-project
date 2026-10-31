import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  findConnection: vi.fn(),
  disconnect: vi.fn(),
  fetch: vi.fn(),
  environment: {
    ENABLE_PUBLISH_SIMULATION: false,
    GOOGLE_OAUTH_CLIENT_ID: "google-client",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
    TIKTOK_API_CLIENT_KEY: "tiktok-client",
    TIKTOK_API_CLIENT_SECRET: "tiktok-secret",
    LINKEDIN_CLIENT_ID: "linkedin-client",
    LINKEDIN_CLIENT_SECRET: "linkedin-secret",
    LINKEDIN_PAGES_CLIENT_ID: "pages-client",
    LINKEDIN_PAGES_CLIENT_SECRET: "pages-secret",
    LINKEDIN_API_VERSION: "202607",
    TWITTER_CLIENT_ID: "twitter-client",
    TWITTER_CLIENT_SECRET: "twitter-secret",
    PLATFORM_TOKEN_ENCRYPTION_KEY: "test-key",
  },
}));
vi.mock("@/db/repositories/publishing.repository", () => ({
  findPlatformConnectionWithTokens: mocks.findConnection,
}));
vi.mock("@/db/commands/platform-connection-commands", () => ({
  disconnectPlatformConnection: mocks.disconnect,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => mocks.environment,
}));
vi.mock("@/lib/crypto/secret-box", () => ({ openSecret: () => "test-token" }));

import { disconnectPlatformAuthorization } from "./disconnect-platform-connection";

const input = {
  workspaceId: "authorized-workspace",
  connectionId: "connection",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }));
  mocks.disconnect.mockResolvedValue({ disconnected: true });
});
afterEach(() => vi.unstubAllGlobals());

describe("disconnect with the real platform OAuth registry", () => {
  it("disconnects a LinkedIn Page locally without revoking other Page/profile grants", async () => {
    mocks.findConnection.mockResolvedValue({
      platform: "linkedin",
      externalAccountId: "urn:li:organization:42",
      accessTokenSealed: "sealed-token",
    });
    await expect(disconnectPlatformAuthorization(input)).resolves.toEqual({
      disconnected: true,
      providerRevoked: false,
    });
    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith(input);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([
    "linkedin",
    "twitter",
    "youtube",
    "facebook",
    "instagram",
    "tiktok",
  ] as const)("clears the workspace's %s credentials", async (platform) => {
    mocks.findConnection.mockResolvedValue({
      platform,
      externalAccountId: "member-id",
      accessTokenSealed: "sealed-token",
    });
    await expect(disconnectPlatformAuthorization(input)).resolves.toMatchObject(
      {
        disconnected: true,
      },
    );
    expect(mocks.findConnection).toHaveBeenCalledExactlyOnceWith(input);
    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith(input);
    if (platform === "linkedin") expect(mocks.fetch).not.toHaveBeenCalled();
    if (platform === "twitter")
      expect(mocks.fetch).toHaveBeenCalledWith(
        "https://api.x.com/2/oauth2/revoke",
        expect.objectContaining({ method: "POST" }),
      );
  });
});
