import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
  session: vi.fn(),
  pages: vi.fn(),
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
vi.mock("@/lib/env/server", () => ({ getPublishingEnvironment: () => ({}) }));
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
  },
}));

import { connectFacebookPageAction } from "@/app/(authenticated)/app/settings/workspace/facebook/select/actions";

function selection() {
  const form = new FormData();
  form.set("pageId", "page-1");
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
    scopes: "",
  });
  mocks.pages.mockResolvedValue([
    {
      externalAccountId: "page-1",
      externalAccountName: "Studio Page",
      pageAccessToken: "test-only",
    },
  ]);
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
      }),
    );
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("test-selection");
  });

  it("returns expired selections to accounts without contacting a provider", async () => {
    mocks.getCookie.mockReturnValue(undefined);
    await expect(connectFacebookPageAction(selection())).rejects.toThrow(
      "REDIRECT:/app/social/accounts?facebook=expired",
    );
    expect(mocks.pages).not.toHaveBeenCalled();
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
  });

  it("does not let editors connect a selected page", async () => {
    mocks.context.mockResolvedValue({ activeMembership: { role: "editor" } });
    await expect(connectFacebookPageAction(selection())).rejects.toThrow();
    expect(mocks.getCookie).not.toHaveBeenCalled();
    expect(mocks.pages).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
