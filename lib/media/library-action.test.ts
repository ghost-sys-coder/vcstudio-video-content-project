import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ context: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: mocks.context,
}));
vi.mock("@/lib/media/load-media-library", () => ({
  loadMediaLibraryPage: mocks.load,
}));
import { getMediaLibraryPageAction } from "@/app/(authenticated)/app/social/library-actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({ assets: [], nextCursor: null });
});
describe("on-demand library authorization", () => {
  it.each(["owner", "editor"])(
    "uses only the server workspace for %s",
    async (role) => {
      mocks.context.mockResolvedValue({
        activeMembership: { workspaceId: "authorized", role },
      });
      expect(
        (
          await getMediaLibraryPageAction({
            kind: "image",
            workspaceId: "injected",
          })
        ).ok,
      ).toBe(true);
      expect(mocks.load).toHaveBeenCalledExactlyOnceWith({
        workspaceId: "authorized",
        kind: "image",
        visualOnly: true,
      });
    },
  );
  it.each([
    null,
    { activeMembership: { workspaceId: "authorized", role: "viewer" } },
  ])(
    "rejects missing membership or insufficient permissions",
    async (context) => {
      mocks.context.mockResolvedValue(context);
      expect((await getMediaLibraryPageAction({})).ok).toBe(false);
      expect(mocks.load).not.toHaveBeenCalled();
    },
  );
  it.each([
    { kind: "audio" },
    { cursor: "malformed" },
    { cursor: "x".repeat(513) },
    null,
  ])("rejects malformed input before database work", async (input) => {
    expect((await getMediaLibraryPageAction(input)).ok).toBe(false);
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("returns a safe retry message on read failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.context.mockResolvedValue({
      activeMembership: { workspaceId: "authorized", role: "owner" },
    });
    mocks.load.mockRejectedValue(new Error("private connection string"));
    const result = await getMediaLibraryPageAction({});
    expect(result).toEqual({
      ok: false,
      error: "The media library could not be loaded. Please try again.",
    });
    expect(log).toHaveBeenCalledWith("Media library page read failed.", {
      workspaceId: "authorized",
    });
    log.mockRestore();
  });
});
