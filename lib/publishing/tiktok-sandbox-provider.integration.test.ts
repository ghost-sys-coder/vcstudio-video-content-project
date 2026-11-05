import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  environment: {
    ENABLE_PUBLISH_SIMULATION: false,
    ENABLE_SOCIAL_POST_SIMULATION: false,
    PLATFORM_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
    TIKTOK_API_CLIENT_KEY: "production-app",
    TIKTOK_API_CLIENT_SECRET: "production-secret",
  },
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => mocks.environment,
}));
import {
  createVideoPublishProvider,
  isPlatformConfigured,
} from "./provider-registry";
import {
  createConnectionOAuthProvider,
  createSocialPostProvider,
  isSocialPostPlatformConfigured,
} from "./social-post-registry";
import { sealTikTokSandboxCredentials } from "./tiktok-sandbox-credentials";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(async () =>
    Response.json({
      access_token: "rotated",
      refresh_token: "new-refresh",
      expires_in: 3600,
      refresh_expires_in: 86400,
      open_id: "account",
      token_type: "Bearer",
      scope: "user.info.basic,video.upload",
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
const workspaceId = "11111111-1111-4111-8111-111111111111";
function connection(clientKey: string, clientSecret: string) {
  return {
    platform: "tiktok" as const,
    workspaceId,
    externalAccountId: clientKey,
    oauthClientCredentialsSealed: sealTikTokSandboxCredentials({
      credentials: { clientKey, clientSecret },
      workspaceId,
      externalAccountId: clientKey,
      key: mocks.environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
    }),
  };
}
describe("per-account TikTok app selection", () => {
  it("refreshes different sandbox accounts using their own credentials and never the global production app", async () => {
    for (const [client, secret] of [
      ["sandbox-one", "secret-one"],
      ["sandbox-two", "secret-two"],
    ]) {
      await createConnectionOAuthProvider(
        connection(client, secret),
      ).refreshTokens({ refreshToken: "existing-refresh" });
      const body = mocks.fetch.mock.lastCall?.[1].body;
      expect(body.get("client_key")).toBe(client);
      expect(body.get("client_secret")).toBe(secret);
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("uses the sandbox app for revocation and both publication factories", async () => {
    const sandbox = connection("sandbox-one", "secret-one");
    await createConnectionOAuthProvider(sandbox).revokeAuthorization?.({
      accessToken: "access",
    });
    expect(mocks.fetch.mock.lastCall?.[1].body.get("client_secret")).toBe(
      "secret-one",
    );
    const provider = createVideoPublishProvider("tiktok", sandbox);
    expect(
      new URL(
        provider.createAuthorizationUrl({
          state: "test",
          redirectUri: "https://studio.example/api/tiktok/callback",
        }),
      ).searchParams.get("client_key"),
    ).toBe("sandbox-one");
    expect(createSocialPostProvider("tiktok", sandbox).platform).toBe("tiktok");
  });
  it("keeps production connections on the configured global app", async () => {
    await createConnectionOAuthProvider({
      platform: "tiktok",
      externalAccountId: "legacy-account",
    }).refreshTokens({ refreshToken: "refresh" });
    expect(mocks.fetch.mock.lastCall?.[1].body.get("client_key")).toBe(
      "production-app",
    );
  });
  it("fails closed on corrupt or cross-workspace sandbox app credentials", () => {
    const stored = connection("sandbox-one", "secret-one");
    expect(() =>
      createConnectionOAuthProvider({
        ...stored,
        workspaceId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow("Reconnect");
    expect(() =>
      createVideoPublishProvider("tiktok", {
        ...stored,
        oauthClientCredentialsSealed: "bad",
      }),
    ).toThrow("Reconnect");
  });
  it("allows a stored sandbox connection without globally configured TikTok credentials", () => {
    const previousKey = mocks.environment.TIKTOK_API_CLIENT_KEY;
    mocks.environment.TIKTOK_API_CLIENT_KEY = "";
    try {
      expect(isPlatformConfigured("tiktok")).toBe(false);
      expect(isPlatformConfigured("tiktok", { isSandbox: true })).toBe(true);
      expect(
        isSocialPostPlatformConfigured("tiktok", {
          externalAccountId: "account",
          isSandbox: true,
        }),
      ).toBe(true);
      expect(() =>
        createSocialPostProvider(
          "tiktok",
          connection("sandbox-one", "secret-one"),
        ),
      ).not.toThrow();
    } finally {
      mocks.environment.TIKTOK_API_CLIENT_KEY = previousKey;
    }
  });
});
