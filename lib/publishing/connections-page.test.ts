import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  listConnections: vi.fn(),
  disconnect: vi.fn(),
  refresh: vi.fn(),
  environment: { ENABLE_VIDEO_PUBLISHING: true, ENABLE_SOCIAL_POSTING: true },
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: mocks.context,
}));
vi.mock("@/db/repositories/publishing.repository", () => ({
  listPlatformConnections: mocks.listConnections,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => mocks.environment,
}));
vi.mock("@/app/(authenticated)/app/settings/workspace/actions", () => ({
  disconnectWorkspaceChannelAction: mocks.disconnect,
}));

import SocialAccountsPage from "@/app/(authenticated)/app/social/accounts/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.environment.ENABLE_VIDEO_PUBLISHING = true;
  mocks.environment.ENABLE_SOCIAL_POSTING = true;
  mocks.listConnections.mockResolvedValue([
    {
      id: "connection-1",
      platform: "linkedin",
      externalAccountName: "Studio LinkedIn",
      externalAccountUrl: null,
      status: "active",
      lastError: null,
      updatedAt: new Date("2026-10-31T00:00:00Z"),
    },
  ]);
});

describe("shared accounts page", () => {
  it.each(["owner", "editor"] as const)(
    "shows workspace-scoped connections and requirements to %s",
    async (role) => {
      mocks.context.mockResolvedValue({
        activeMembership: { workspaceId: "authorized-workspace", role },
      });
      const page = await SocialAccountsPage({
        searchParams: Promise.resolve({ linkedin: "connected" }),
      });
      const markup = renderToStaticMarkup(page);
      expect(mocks.listConnections).toHaveBeenCalledExactlyOnceWith({
        workspaceId: "authorized-workspace",
      });
      expect(markup).toContain("Accounts &amp; connections");
      expect(markup).toContain("Studio LinkedIn");
      expect(markup).toContain(
        "Text on its own, up to 20 images, or one video.",
      );
      expect(markup).toContain("The LinkedIn account is now connected");
      if (role === "owner") {
        expect(markup).toContain('href="/api/linkedin/authorize"');
        expect(markup).toContain('href="/api/youtube/authorize"');
        expect(markup).toContain('href="/api/tiktok/authorize"');
        expect(markup).not.toContain("Sandbox Client Secret");
        expect(markup).not.toContain("Sandbox Client Key");
        expect(markup).toContain(
          "TikTok opens its own sign-in and authorization page",
        );
        expect(markup).toContain("Disconnect</button>");
      } else {
        expect(markup).not.toContain("/authorize");
        expect(markup).not.toContain("Disconnect</button>");
        expect(markup).not.toContain("/app/settings/workspace");
        expect(markup).toContain("Only workspace owners");
      }
      expect(mocks.disconnect).not.toHaveBeenCalled();
    },
  );

  it("denies viewers before reading any connections", async () => {
    mocks.context.mockResolvedValue({ activeMembership: { role: "viewer" } });
    await expect(
      SocialAccountsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/app/access-denied");
    expect(mocks.listConnections).not.toHaveBeenCalled();
  });

  it("requires an authenticated workspace before reading connections", async () => {
    mocks.context.mockResolvedValue(null);
    await expect(
      SocialAccountsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/onboarding");
    expect(mocks.listConnections).not.toHaveBeenCalled();
  });

  it("keeps connect controls off when both publishing flags are disabled", async () => {
    mocks.context.mockResolvedValue({
      activeMembership: { workspaceId: "authorized-workspace", role: "owner" },
    });
    mocks.environment.ENABLE_VIDEO_PUBLISHING = false;
    mocks.environment.ENABLE_SOCIAL_POSTING = false;
    const markup = renderToStaticMarkup(
      await SocialAccountsPage({ searchParams: Promise.resolve({}) }),
    );
    expect(markup).not.toContain("/authorize");
    expect(markup).toContain("Studio LinkedIn");
  });
});
