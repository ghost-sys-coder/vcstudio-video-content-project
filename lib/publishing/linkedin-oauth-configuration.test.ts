import { afterEach, describe, expect, it, vi } from "vitest";
import { publishingEnvironmentSchema } from "@/lib/env/server-schema";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () =>
    publishingEnvironmentSchema.parse({
      PLATFORM_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      LINKEDIN_CLIENT_ID: " \tprofile-id\r\n",
      LINKEDIN_CLIENT_SECRET: "\nprofile-secret\t ",
      LINKEDIN_PAGES_CLIENT_ID: " pages-id ",
      LINKEDIN_PAGES_CLIENT_SECRET: "\tpages-secret\n",
    }),
}));

import {
  createConnectionOAuthProvider,
  createLinkedInPagesProvider,
  createPlatformOAuthProvider,
} from "@/lib/publishing/social-post-registry";

afterEach(() => vi.unstubAllGlobals());

describe("LinkedIn credentials from validated environment", () => {
  it.each([
    { kind: "profile", externalAccountId: "member-1" },
    { kind: "pages", externalAccountId: "urn:li:organization:42" },
  ])(
    "uses the same clean $kind credentials for authorization, exchange, and refresh",
    async ({ kind, externalAccountId }) => {
      const request = vi.fn<typeof fetch>().mockImplementation(async (url) => {
        const body = String(url).endsWith("/userinfo")
          ? { sub: "member-1", name: "Studio member" }
          : { access_token: "issued-token", refresh_token: "issued-refresh" };
        return new Response(JSON.stringify(body), { status: 200 });
      });
      vi.stubGlobal("fetch", request);
      const authorizationRequest = {
        state: "test-state",
        redirectUri: `https://studio.test/api/linkedin/${kind}/callback`,
      };
      const provider =
        kind === "pages"
          ? createLinkedInPagesProvider()
          : createPlatformOAuthProvider("linkedin");
      const url = new URL(
        provider.createAuthorizationUrl(authorizationRequest),
      );
      expect(url.searchParams.get("client_id")).toBe(`${kind}-id`);

      const exchangeRequest = {
        code: "test-code",
        redirectUri: authorizationRequest.redirectUri,
      };
      if (kind === "pages")
        await createLinkedInPagesProvider().exchangeTokens(exchangeRequest);
      else
        await createPlatformOAuthProvider("linkedin").exchangeCode(
          exchangeRequest,
        );

      await createConnectionOAuthProvider({
        platform: "linkedin",
        externalAccountId,
      }).refreshTokens({ refreshToken: "stored-refresh" });
      const tokenCalls = request.mock.calls.filter(([url]) =>
        String(url).endsWith("/accessToken"),
      );
      expect(tokenCalls).toHaveLength(2);
      for (const [, init] of tokenCalls) {
        expect(init?.body).toBeInstanceOf(URLSearchParams);
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("client_id")).toBe(`${kind}-id`);
        expect(body.get("client_secret")).toBe(`${kind}-secret`);
      }
    },
  );
});
