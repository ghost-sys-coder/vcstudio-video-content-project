import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/components/social/MediaLibraryWorkspace", () => ({
  MediaLibraryWorkspace: vi.fn(),
}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  load: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: mocks.context,
}));
vi.mock("@/lib/media/load-media-library", () => ({
  loadMediaLibrary: mocks.load,
}));
vi.mock("@/lib/env/server", () => ({
  getMediaLibraryEnvironment: () => ({
    MAX_MEDIA_IMAGE_BYTES: 1000,
    MAX_MEDIA_VIDEO_BYTES: 2000,
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import MediaLibraryPage from "@/app/(authenticated)/app/social/library/page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({
    assets: [],
    total: 0,
    pageSize: 24,
    kind: "image",
  });
  mocks.redirect.mockImplementation(() => {
    throw new Error("redirect");
  });
});
describe("library page boundaries", () => {
  it("remounts local asset state when the authorized workspace changes", async () => {
    const keys = [];
    for (const workspaceId of ["first", "second"]) {
      mocks.context.mockResolvedValue({
        activeMembership: { workspaceId, role: "owner" },
      });
      const page = await MediaLibraryPage({
        searchParams: Promise.resolve({ kind: "image" }),
      });
      keys.push(page.key);
      expect(mocks.load).toHaveBeenLastCalledWith({
        workspaceId,
        kind: "image",
        cursor: undefined,
      });
    }
    expect(keys).toEqual(["first:image:first", "second:image:first"]);
  });
  it("rejects a viewer before requesting any library data", async () => {
    mocks.context.mockResolvedValue({
      activeMembership: { workspaceId: "authorized", role: "viewer" },
    });
    await expect(
      MediaLibraryPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/app/access-denied");
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
