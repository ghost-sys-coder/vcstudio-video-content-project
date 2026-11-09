import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
  session: vi.fn(),
  pages: vi.fn(),
  page: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.getCookie, delete: mocks.deleteCookie }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: mocks.context,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({ ENABLE_VIDEO_PUBLISHING: true }),
}));
vi.mock("@/db/commands/platform-connection-commands", () => ({
  upsertPlatformConnection: mocks.save,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: mocks.audit,
}));
vi.mock("@/lib/publishing/facebook-oauth-session", () => ({
  FACEBOOK_OAUTH_SESSION_COOKIE: "test-selection",
  readFacebookOAuthSession: mocks.session,
}));
vi.mock("@/lib/publishing/providers/facebook-video-publish-provider", () => ({
  FacebookVideoPublishProvider: class {
    listPages = mocks.pages;
    getPage = mocks.page;
  },
}));

import {
  connectFacebookPageAction,
  findFacebookPageAction,
} from "@/app/(authenticated)/app/settings/workspace/facebook/select/actions";
import FacebookPageSelectionPage from "@/app/(authenticated)/app/settings/workspace/facebook/select/page";

function selection() {
  const form = new FormData();
  form.set("pageId", "1025029520688408");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    activeMembership: { workspaceId: "workspace-1", role: "owner" },
    user: { id: "user-1" },
  });
  mocks.getCookie.mockReturnValue({ value: "test-sealed-session" });
  mocks.session.mockReturnValue({
    workspaceId: "workspace-1",
    userId: "user-1",
    userAccessToken: "test-only",
    scopes: ["pages_show_list", "pages_manage_posts"],
  });
  mocks.pages.mockResolvedValue([
    {
      externalAccountId: "1351059488083028",
      externalAccountName: "Studio Page",
      pageAccessToken: "test-only",
    },
  ]);
  mocks.page.mockResolvedValue({
    externalAccountId: "1025029520688408",
    externalAccountName: "VeilCode Studio",
    pageAccessToken: "test-page-secret",
  });
  mocks.save.mockResolvedValue({ id: "connection-1" });
});

describe("Facebook selection returns to shared accounts", () => {
  it("completes owner consent, audits the connection and returns to accounts", async () => {
    await expect(connectFacebookPageAction(selection())).rejects.toThrow(
      "REDIRECT:/app/social/accounts?facebook=connected",
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        connectedByUserId: "user-1",
        platform: "facebook",
        account: expect.objectContaining({
          externalAccountId: "1025029520688408",
        }),
        tokens: expect.objectContaining({ accessToken: "test-page-secret" }),
      }),
    );
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("test-selection");
    expect(mocks.page).toHaveBeenCalledExactlyOnceWith({
      userAccessToken: "test-only",
      pageId: "1025029520688408",
    });
    expect(mocks.pages).not.toHaveBeenCalled();
  });

  it("returns expired selections to accounts without contacting a provider", async () => {
    mocks.getCookie.mockReturnValue(undefined);
    await expect(connectFacebookPageAction(selection())).rejects.toThrow(
      "REDIRECT:/app/social/accounts?facebook=expired",
    );
    expect(mocks.pages).not.toHaveBeenCalled();
    expect(mocks.page).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects a selection bound to another workspace", async () => {
    mocks.session.mockReturnValue({
      workspaceId: "other-workspace",
      userId: "user-1",
      userAccessToken: "test-only",
    });
    await expect(connectFacebookPageAction(selection())).rejects.toThrow(
      "REDIRECT:/app/social/accounts?facebook=forbidden",
    );
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.page).not.toHaveBeenCalled();
    expect(mocks.pages).not.toHaveBeenCalled();
  });

  it("does not let editors connect a selected page", async () => {
    mocks.context.mockResolvedValue({ activeMembership: { role: "editor" } });
    await expect(connectFacebookPageAction(selection())).rejects.toThrow();
    expect(mocks.getCookie).not.toHaveBeenCalled();
    expect(mocks.pages).not.toHaveBeenCalled();
    expect(mocks.page).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("finds an authorized Page missing from the list without saving or exposing its token", async () => {
    const result = await findFacebookPageAction(
      { page: null, error: null },
      selection(),
    );
    expect(result).toEqual({
      page: {
        externalAccountId: "1025029520688408",
        externalAccountName: "VeilCode Studio",
      },
      error: null,
    });
    expect(JSON.stringify(result)).not.toContain("test-page-secret");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
  });

  it.each(["https://facebook.com/page", "../me", "", "1".repeat(33)])(
    "rejects invalid Page ID %s before contacting Meta",
    async (pageId) => {
      const form = selection();
      form.set("pageId", pageId);
      const result = await findFacebookPageAction(
        { page: null, error: null },
        form,
      );
      expect(result.error).toBe("Enter the numeric Facebook Page ID.");
      expect(mocks.page).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );

  it("reports a provider permission denial without saving or consuming consent", async () => {
    mocks.page.mockRejectedValue(
      new PublishProviderError({
        category: "insufficient_permissions",
        safeMessage: "Select the Page and confirm your Page role.",
        mayHavePublished: false,
        retriable: false,
      }),
    );
    const result = await findFacebookPageAction(
      { page: null, error: null },
      selection(),
    );
    expect(result.error).toBe("Select the Page and confirm your Page role.");
    await expect(connectFacebookPageAction(selection())).rejects.toThrow(
      "REDIRECT:/app/social/accounts?facebook=failed",
    );
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
  });

  it("redacts raw provider failures", async () => {
    mocks.page.mockRejectedValue(new Error("secret-user-token in a URL"));
    const result = await findFacebookPageAction(
      { page: null, error: null },
      selection(),
    );
    expect(result.error).toContain("try again");
    expect(JSON.stringify(result)).not.toContain("secret-user-token");
  });

  it.each(["editor", "viewer"])(
    "denies %s lookup before reading a cookie",
    async (role) => {
      mocks.context.mockResolvedValue({ activeMembership: { role } });
      await expect(
        findFacebookPageAction({ page: null, error: null }, selection()),
      ).rejects.toThrow();
      expect(mocks.getCookie).not.toHaveBeenCalled();
      expect(mocks.page).not.toHaveBeenCalled();
    },
  );

  it.each(["workspaceId", "userId"])(
    "rejects a mismatched %s before discovery or lookup",
    async (field) => {
      mocks.session.mockReturnValue({
        workspaceId: "workspace-1",
        userId: "user-1",
        userAccessToken: "test-only",
        [field]: "another-identity",
      });
      await expect(FacebookPageSelectionPage()).rejects.toThrow(
        "facebook=forbidden",
      );
      await expect(
        findFacebookPageAction({ page: null, error: null }, selection()),
      ).rejects.toThrow("facebook=forbidden");
      expect(mocks.pages).not.toHaveBeenCalled();
      expect(mocks.page).not.toHaveBeenCalled();
    },
  );

  it("redirects expired consent without contacting Meta", async () => {
    mocks.session.mockImplementationOnce(() => {
      throw new Error("expired");
    });
    await expect(
      findFacebookPageAction({ page: null, error: null }, selection()),
    ).rejects.toThrow("facebook=expired");
    expect(mocks.page).not.toHaveBeenCalled();
  });

  it("passes only public Page identity to the selection UI", async () => {
    const page = await FacebookPageSelectionPage();
    expect(page.props.pages).toEqual([
      {
        externalAccountId: "1351059488083028",
        externalAccountName: "Studio Page",
      },
    ]);
    expect(JSON.stringify(page.props.pages)).not.toContain("test-only");
  });
});
