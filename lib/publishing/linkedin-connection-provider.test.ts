import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  env: {
    ENABLE_SOCIAL_POST_SIMULATION: false,
    ENABLE_PUBLISH_SIMULATION: false,
    LINKEDIN_CLIENT_ID: "profile-id",
    LINKEDIN_CLIENT_SECRET: "profile-secret",
    LINKEDIN_PAGES_CLIENT_ID: "pages-id",
    LINKEDIN_PAGES_CLIENT_SECRET: "pages-secret",
    LINKEDIN_API_VERSION: "202607",
  },
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => mocks.env,
}));
import {
  createConnectionOAuthProvider,
  isSocialPostPlatformConfigured,
} from "./social-post-registry";
import { resolveLinkedInAccount } from "./linkedin-account";

beforeEach(() => {
  mocks.env.LINKEDIN_CLIENT_ID = "profile-id";
  mocks.env.LINKEDIN_PAGES_CLIENT_ID = "pages-id";
});
afterEach(() => vi.unstubAllGlobals());
describe("stored LinkedIn identity selects its OAuth application", () => {
  it.each([
    ["member-1", "profile-id", "profile-secret"],
    ["42", "profile-id", "profile-secret"],
    ["urn:li:person:member-1", "profile-id", "profile-secret"],
    ["urn:li:organization:42", "pages-id", "pages-secret"],
  ])(
    "refreshes %s with %s",
    async (externalAccountId, clientId, clientSecret) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ access_token: "refreshed" }), {
          status: 200,
        }),
      );
      vi.stubGlobal("fetch", request);
      await createConnectionOAuthProvider({
        platform: "linkedin",
        externalAccountId,
      }).refreshTokens({ refreshToken: "stored-refresh" });
      const body = request.mock.calls[0]?.[1]?.body;
      expect(body).toBeInstanceOf(URLSearchParams);
      expect(String(body)).toContain(`client_id=${clientId}`);
      expect(String(body)).toContain(`client_secret=${clientSecret}`);
    },
  );
  it("gates each account against its own credential pair", () => {
    mocks.env.LINKEDIN_PAGES_CLIENT_ID = "";
    expect(
      isSocialPostPlatformConfigured("linkedin", {
        externalAccountId: "urn:li:organization:42",
      }),
    ).toBe(false);
    expect(
      isSocialPostPlatformConfigured("linkedin", {
        externalAccountId: "member",
      }),
    ).toBe(true);
    mocks.env.LINKEDIN_PAGES_CLIENT_ID = "pages-id";
    mocks.env.LINKEDIN_CLIENT_ID = "";
    expect(
      isSocialPostPlatformConfigured("linkedin", {
        externalAccountId: "urn:li:organization:42",
      }),
    ).toBe(true);
    expect(
      isSocialPostPlatformConfigured("linkedin", {
        externalAccountId: "member",
      }),
    ).toBe(false);
  });
  it("rejects malformed organization identities without falling back to personal credentials", () => {
    expect(() =>
      createConnectionOAuthProvider({
        platform: "linkedin",
        externalAccountId: "urn:li:organization:../42",
      }),
    ).toThrow();
    expect(() => resolveLinkedInAccount("urn:li:organization:0")).toThrow();
  });
});
