import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  provider: vi.fn(),
  exchange: vi.fn(),
  list: vi.fn(),
  permission: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
  jar: new Map<string, string>(),
  setCookie: vi.fn(),
  env: {
    ENABLE_SOCIAL_POSTING: true,
    PLATFORM_TOKEN_ENCRYPTION_KEY: "07".repeat(32),
  },
  web: {
    APP_BASE_URL: "https://studio.test",
    OAUTH_STATE_SECRET: "s".repeat(48),
    OAUTH_STATE_TTL_SECONDS: 600,
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.jar.get(name);
      return value ? { value } : undefined;
    },
    set: mocks.setCookie,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: mocks.context,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => mocks.env,
  getPublishingWebEnvironment: () => mocks.web,
}));
vi.mock("@/lib/publishing/social-post-registry", () => ({
  createLinkedInPagesProvider: mocks.provider,
}));
vi.mock("@/db/commands/platform-connection-commands", () => ({
  upsertPlatformConnection: mocks.save,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: mocks.audit,
}));

import { GET as authorize } from "@/app/api/linkedin/pages/authorize/route";
import { GET as callback } from "@/app/api/linkedin/pages/callback/route";
import SelectionPage from "@/app/(authenticated)/app/social/accounts/linkedin-pages/page";
import {
  connectLinkedInPageAction,
  cancelLinkedInPageSelectionAction,
} from "@/app/(authenticated)/app/social/accounts/linkedin-pages/actions";
import { createOAuthState } from "./oauth-state";
import {
  createLinkedInPagesSession,
  readLinkedInPagesSession,
  LINKEDIN_PAGES_SESSION_COOKIE,
  LINKEDIN_PAGES_STATE_COOKIE,
} from "./linkedin-pages-session";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const actor = "actor";
const page = {
  externalAccountId: "urn:li:organization:42",
  externalAccountName: "Verified Page",
  externalAccountUrl: "https://www.linkedin.com/company/verified/",
  memberUrn: "urn:li:person:member",
};
const tokens = {
  accessToken: "private-access",
  refreshToken: "private-refresh",
  expiresAt: new Date("2030-01-01"),
  scopes: ["rw_organization_admin", "w_organization_social"],
};
function seedSelection(
  overrides: {
    workspaceId?: string;
    userId?: string;
    ttlSeconds?: number;
  } = {},
) {
  mocks.jar.set(
    LINKEDIN_PAGES_SESSION_COOKIE,
    createLinkedInPagesSession(
      { workspaceId, userId: actor, ttlSeconds: 600, tokens, ...overrides },
      mocks.env.PLATFORM_TOKEN_ENCRYPTION_KEY,
    ),
  );
}
function state(
  platform = "linkedin-pages",
  overrides: { workspaceId?: string; userId?: string } = {},
) {
  const value = createOAuthState({
    workspaceId,
    userId: actor,
    platform,
    secret: mocks.web.OAUTH_STATE_SECRET,
    ...overrides,
  });
  mocks.jar.set(LINKEDIN_PAGES_STATE_COOKIE, value);
  return value;
}
function callbackRequest(value: string, extra = "code=authorization-code") {
  return new Request(
    `https://studio.test/api/linkedin/pages/callback?state=${encodeURIComponent(value)}&${extra}`,
  );
}
function form(pageId = page.externalAccountId) {
  const data = new FormData();
  data.set("pageId", pageId);
  data.set("start", "0");
  data.set("workspaceId", "untrusted");
  data.set("accountName", "forged");
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.jar.clear();
  mocks.env.ENABLE_SOCIAL_POSTING = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.context.mockResolvedValue({
    activeMembership: { workspaceId, role: "owner" },
    user: { id: actor },
  });
  mocks.provider.mockReturnValue({
    createAuthorizationUrl: ({ state: value }: { state: string }) =>
      `https://www.linkedin.com/oauth/v2/authorization?state=${encodeURIComponent(value)}`,
    exchangeTokens: mocks.exchange,
    listPages: mocks.list,
    assertCanPublish: mocks.permission,
  });
  mocks.exchange.mockResolvedValue(tokens);
  mocks.list.mockResolvedValue({ pages: [page], start: 0, nextStart: 10 });
  mocks.permission.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue({ id: "saved-connection" });
  mocks.setCookie.mockImplementation(
    (name: string, value: string, options: { maxAge?: number }) => {
      if (options.maxAge === 0) mocks.jar.delete(name);
      else mocks.jar.set(name, value);
    },
  );
});
afterEach(() => vi.restoreAllMocks());

describe("Page authorization and callback", () => {
  it("starts an owner-only, browser-bound flow without storing a connection", async () => {
    const response = await authorize();
    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const cookie = response.cookies.get(LINKEDIN_PAGES_STATE_COOKIE);
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/api/linkedin/pages",
    });
    expect(
      new URL(response.headers.get("location") ?? "").searchParams.get("state"),
    ).toBe(cookie?.value);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each(["editor", "viewer"])(
    "rejects %s before provider work",
    async (role) => {
      mocks.context.mockResolvedValue({
        activeMembership: { workspaceId, role },
        user: { id: actor },
      });
      expect((await authorize()).status).toBe(403);
      expect(
        (await callback(callbackRequest(state()))).headers.get("location"),
      ).toContain("linkedinPages=forbidden");
      expect(mocks.provider).not.toHaveBeenCalled();
    },
  );
  it("honors social-posting disablement without provider work", async () => {
    mocks.env.ENABLE_SOCIAL_POSTING = false;
    expect((await authorize()).status).toBe(404);
    expect(
      (await callback(callbackRequest(state()))).headers.get("location"),
    ).toContain("linkedinPages=failed");
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("requires the browser's state cookie", async () => {
    const value = state();
    mocks.jar.clear();
    expect(
      (await callback(callbackRequest(value))).headers.get("location"),
    ).toContain("linkedinPages=invalid");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it.each([
    { workspaceId: "22222222-2222-4222-8222-222222222222" },
    { userId: "another-user" },
  ])("rejects signed state bound to another session: %j", async (overrides) => {
    expect(
      (
        await callback(callbackRequest(state("linkedin-pages", overrides)))
      ).headers.get("location"),
    ).toContain("linkedinPages=forbidden");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("rejects replay of a personal-profile OAuth state", async () => {
    const response = await callback(callbackRequest(state("linkedin")));
    expect(response.headers.get("location")).not.toContain("/linkedin-pages");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("returns consent cancellation without token exchange", async () => {
    expect(
      (
        await callback(callbackRequest(state(), "error=access_denied"))
      ).headers.get("location"),
    ).toContain("linkedinPages=cancelled");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("keeps tokens encrypted in a short-lived, scoped cookie until selection", async () => {
    const response = await callback(callbackRequest(state()));
    expect(response.headers.get("location")).toBe(
      "https://studio.test/app/social/accounts/linkedin-pages",
    );
    const cookie = response.cookies.get(LINKEDIN_PAGES_SESSION_COOKIE);
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/app/social/accounts/linkedin-pages",
      maxAge: 600,
    });
    expect(cookie?.value).not.toContain("private-access");
    if (!cookie?.value) throw new Error("Missing selection cookie");
    expect(
      readLinkedInPagesSession({
        sealed: cookie.value,
        key: mocks.env.PLATFORM_TOKEN_ENCRYPTION_KEY,
      }),
    ).toMatchObject({
      workspaceId,
      userId: actor,
      refreshToken: "private-refresh",
    });
    expect(response.cookies.get(LINKEDIN_PAGES_STATE_COOKIE)?.maxAge).toBe(0);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe("Page selection isolation and persistence", () => {
  it("projects only Page identity/name into the selector", async () => {
    seedSelection();
    const element = await SelectionPage({ searchParams: Promise.resolve({}) });
    expect(element).toMatchObject({
      props: {
        pages: [{ id: page.externalAccountId, name: page.externalAccountName }],
        start: 0,
        nextStart: 10,
      },
    });
    expect(JSON.stringify(element.props)).not.toMatch(
      /private-access|private-refresh|memberUrn/,
    );
  });
  it.each([
    { workspaceId: "22222222-2222-4222-8222-222222222222" },
    { userId: "other" },
  ])(
    "rejects a different workspace/user before any provider read: %j",
    async (overrides) => {
      seedSelection(overrides);
      await expect(
        SelectionPage({ searchParams: Promise.resolve({}) }),
      ).rejects.toThrow(
        "REDIRECT:/app/social/accounts?linkedinPages=forbidden",
      );
      expect(
        (await connectLinkedInPageAction({ error: null }, form())).error,
      ).toBeTruthy();
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );
  it("rejects expired, missing and invalid cursors before provider work", async () => {
    await expect(
      SelectionPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("linkedinPages=expired");
    seedSelection({ ttlSeconds: -1 });
    expect(
      (await connectLinkedInPageAction({ error: null }, form())).error,
    ).toContain("expired");
    await expect(
      SelectionPage({ searchParams: Promise.resolve({ start: "-10" }) }),
    ).rejects.toThrow("linkedinPages=invalid");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it.each(["editor", "viewer"])(
    "rejects forged selection by %s",
    async (role) => {
      seedSelection();
      mocks.context.mockResolvedValue({
        activeMembership: { workspaceId, role },
        user: { id: actor },
      });
      expect(
        (await connectLinkedInPageAction({ error: null }, form())).error,
      ).toBeTruthy();
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );
  it("rejects a Page not returned by the fresh member-bound ACL query", async () => {
    seedSelection();
    expect(
      (
        await connectLinkedInPageAction(
          { error: null },
          form("urn:li:organization:999"),
        )
      ).error,
    ).toContain("no longer available");
    expect(mocks.permission).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rechecks publishing permission and refuses a revoked grant", async () => {
    seedSelection();
    mocks.permission.mockRejectedValue(new Error("permission denied"));
    expect(
      (await connectLinkedInPageAction({ error: null }, form())).error,
    ).toBeTruthy();
    expect(mocks.permission).toHaveBeenCalledWith({
      accessToken: tokens.accessToken,
      page,
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
  it("saves only server-derived identity, audits, consumes the cookie and returns to accounts", async () => {
    seedSelection();
    await expect(
      connectLinkedInPageAction({ error: null }, form()),
    ).rejects.toThrow("REDIRECT:/app/social/accounts?linkedinPages=connected");
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
      workspaceId,
      platform: "linkedin",
      account: {
        externalAccountId: page.externalAccountId,
        externalAccountName: page.externalAccountName,
        externalAccountUrl: page.externalAccountUrl,
      },
      tokens,
      connectedByUserId: actor,
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        action: "platform_connected",
        targetId: "saved-connection",
        metadata: { accountType: "linkedin_page" },
      }),
    );
    expect(mocks.setCookie).toHaveBeenCalledWith(
      LINKEDIN_PAGES_SESSION_COOKIE,
      "",
      expect.objectContaining({
        maxAge: 0,
        path: "/app/social/accounts/linkedin-pages",
      }),
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/app/social/accounts");
    expect(
      (await connectLinkedInPageAction({ error: null }, form())).error,
    ).toContain("expired");
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it("retains the selection and shows a safe retryable error on persistence failure", async () => {
    seedSelection();
    mocks.save.mockRejectedValue(new Error("secret database detail"));
    const result = await connectLinkedInPageAction({ error: null }, form());
    expect(result.error).not.toContain("secret database detail");
    expect(result.error).toContain("try again");
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
  it("cancels by clearing only the scoped session cookie without a mutation", async () => {
    seedSelection();
    await expect(cancelLinkedInPageSelectionAction()).rejects.toThrow(
      "linkedinPages=cancelled",
    );
    expect(mocks.jar.has(LINKEDIN_PAGES_SESSION_COOKIE)).toBe(false);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("accepts Cancel from an empty selector without validating or connecting a Page", async () => {
    seedSelection();
    const data = new FormData();
    data.set("intent", "cancel");
    await expect(
      connectLinkedInPageAction({ error: null }, data),
    ).rejects.toThrow("linkedinPages=cancelled");
    expect(mocks.jar.has(LINKEDIN_PAGES_SESSION_COOKIE)).toBe(false);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects repeated cursor parameters and invalid Page identities before provider work", async () => {
    seedSelection();
    await expect(
      SelectionPage({ searchParams: Promise.resolve({ start: ["0", "10"] }) }),
    ).rejects.toThrow("linkedinPages=invalid");
    expect(
      (await connectLinkedInPageAction({ error: null }, form("42"))).error,
    ).toContain("valid LinkedIn Page");
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("honors feature disablement after consent and before selection", async () => {
    seedSelection();
    mocks.env.ENABLE_SOCIAL_POSTING = false;
    expect(
      (await connectLinkedInPageAction({ error: null }, form())).error,
    ).toBeTruthy();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
