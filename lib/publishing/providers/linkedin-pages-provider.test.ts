import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { LinkedInPagesProvider } from "./linkedin-pages-provider";
import { LinkedInOAuthProvider } from "./linkedin-oauth-provider";

const fetchMock = vi.fn<typeof fetch>();
const provider = () =>
  new LinkedInPagesProvider({
    clientId: "pages-id",
    clientSecret: "pages-secret",
    apiVersion: "202607",
  });
const page = {
  externalAccountId: "urn:li:organization:42",
  externalAccountName: "Studio",
  externalAccountUrl: "https://www.linkedin.com/company/studio/",
  memberUrn: "urn:li:person:member",
};
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const acl = {
  role: "ADMINISTRATOR",
  state: "APPROVED",
  organization: page.externalAccountId,
  roleAssignee: page.memberUrn,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("dedicated LinkedIn Pages OAuth", () => {
  it("requests only Community Management permissions using the Pages client", () => {
    const url = new URL(
      provider().createAuthorizationUrl({
        state: "signed-pages-state",
        redirectUri: "https://studio.test/api/linkedin/pages/callback",
      }),
    );
    expect(url.searchParams.get("client_id")).toBe("pages-id");
    expect(url.searchParams.get("scope")).toBe(
      "rw_organization_admin w_organization_social",
    );
    expect(url.searchParams.get("state")).toBe("signed-pages-state");
  });
  it("exchanges tokens without calling OpenID userinfo", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        access_token: "page-token",
        expires_in: 3600,
        refresh_token: "page-refresh",
        scope: "rw_organization_admin,w_organization_social",
      }),
    );
    const tokens = await provider().exchangeTokens({
      code: "code",
      redirectUri: "https://studio.test/callback",
    });
    expect(tokens.accessToken).toBe("page-token");
    expect(tokens.refreshToken).toBe("page-refresh");
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(String(body)).toContain("client_id=pages-id");
    expect(String(body)).toContain("client_secret=pages-secret");
  });
  it("retains a refresh token if LinkedIn does not rotate it", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ access_token: "new-token", expires_in: 3600 }),
    );
    const tokens = await provider().refreshTokens({
      refreshToken: "previous-refresh",
    });
    expect(tokens.refreshToken).toBe("previous-refresh");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      "grant_type=refresh_token",
    );
  });
  it("rejects a partial grant", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ access_token: "token", scope: "w_organization_social" }),
    );
    await expect(
      provider().exchangeTokens({
        code: "code",
        redirectUri: "https://studio.test/callback",
      }),
    ).rejects.toMatchObject({
      failure: { category: "insufficient_permissions" },
    });
  });
  it("preserves personal-profile OAuth and its own app credentials", async () => {
    const profile = new LinkedInOAuthProvider({
      clientId: "profile-id",
      clientSecret: "profile-secret",
    });
    expect(
      new URL(
        profile.createAuthorizationUrl({
          state: "profile",
          redirectUri: "https://studio.test/profile-callback",
        }),
      ).searchParams.get("scope"),
    ).toBe("openid profile w_member_social");
    fetchMock
      .mockResolvedValueOnce(
        json({ access_token: "profile-token", scope: "w_member_social" }),
      )
      .mockResolvedValueOnce(json({ sub: "member-1", name: "Member" }));
    await expect(
      profile.exchangeCode({
        code: "code",
        redirectUri: "https://studio.test/profile-callback",
      }),
    ).resolves.toMatchObject({ account: { externalAccountId: "member-1" } });
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      "client_id=profile-id",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.linkedin.com/v2/userinfo",
    );
  });
});

describe("LinkedIn Page discovery and permissions", () => {
  it("does not offer content-only roles that cannot use administered organization lookup", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ elements: [{ ...acl, role: "CONTENT_ADMINISTRATOR" }] }),
    );
    await expect(
      provider().listPages({ accessToken: "token" }),
    ).resolves.toMatchObject({ pages: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(
      new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("role"),
    ).toBe("ADMINISTRATOR");
  });
  it("lists approved eligible roles, ignores sponsored-only roles, deduplicates and bounds reads", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          elements: [
            acl,
            {
              ...acl,
              organization: undefined,
              organizationTarget: acl.organization,
            },
            {
              ...acl,
              organization: "urn:li:organization:99",
              role: "DIRECT_SPONSORED_CONTENT_POSTER",
            },
            { ...acl, state: "REVOKED" },
          ],
          paging: { links: [{ rel: "next", href: "https://untrusted.test/" }] },
        }),
      )
      .mockResolvedValueOnce(
        json({ id: 42, localizedName: "Studio", vanityName: "studio" }),
      );
    const result = await provider().listPages({ accessToken: "token" });
    expect(result).toEqual({ pages: [page], start: 0, nextStart: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://api.linkedin.com");
    expect(url.searchParams.get("count")).toBe("10");
    expect(url.searchParams.get("q")).toBe("roleAssignee");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "LinkedIn-Version": "202607",
    });
  });
  it("loads subsequent ACL pages on demand without following provider URLs", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ elements: [], paging: { links: [] } }),
    );
    await expect(
      provider().listPages({ accessToken: "token", start: 10 }),
    ).resolves.toEqual({ pages: [], start: 10, nextStart: null });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("start=10");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("rejects invalid cursors before any provider request", async () => {
    await expect(
      provider().listPages({ accessToken: "token", start: -10 }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed if organization metadata names a different Page", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ elements: [acl] }))
      .mockResolvedValueOnce(json({ id: 99, localizedName: "Other Page" }));
    await expect(
      provider().listPages({ accessToken: "token" }),
    ).rejects.toThrow();
  });
  it("checks permission to create organic content for the exact member and Page", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        impersonator: page.memberUrn,
        organization: page.externalAccountId,
        status: { "com.linkedin.organization.Approved": {} },
      }),
    );
    await expect(
      provider().assertCanPublish({ accessToken: "token", page }),
    ).resolves.toBeUndefined();
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("ORGANIC_SHARE_CREATE");
    expect(url).toContain("urn%3Ali%3Aorganization%3A42");
    expect(url).toContain("urn%3Ali%3Aperson%3Amember");
  });
  it.each([
    { status: { "com.linkedin.organization.Denied": {} } },
    { status: { "com.linkedin.organization.Approved": false } },
    {
      organization: "urn:li:organization:99",
      status: { "com.linkedin.organization.Approved": {} },
    },
    {
      impersonator: "urn:li:person:other",
      status: { "com.linkedin.organization.Approved": {} },
    },
  ])(
    "rejects denied, malformed or mismatched permission responses: %j",
    async (overrides) => {
      fetchMock.mockResolvedValueOnce(
        json({
          impersonator: page.memberUrn,
          organization: page.externalAccountId,
          ...overrides,
        }),
      );
      await expect(
        provider().assertCanPublish({ accessToken: "token", page }),
      ).rejects.toThrow();
    },
  );
});
