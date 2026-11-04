import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "@/db/schema";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  posts: vi.fn(),
  targets: vi.fn(),
  summaries: vi.fn(),
  media: vi.fn(),
  connections: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@/db/repositories/social-posts.repository", () => ({
  listSocialPosts: mocks.posts,
  listSocialPostTargetsForPosts: mocks.targets,
  listSocialPostMediaSummaries: mocks.summaries,
  listSocialPostMedia: mocks.media,
  listSocialPostTargets: vi.fn(),
  findSocialPost: vi.fn(),
}));
vi.mock("@/db/repositories/publishing.repository", () => ({
  listPlatformConnections: mocks.connections,
}));
vi.mock("@/db/commands/social-post-commands", () => ({
  isEditableStatus: vi.fn(),
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  createMediaAssetDownloadUrl: mocks.sign,
}));
import { loadSocialPostsView } from "./load-social-posts";
function post(index: number): SocialPost {
  return {
    id: `post-${index}`,
    workspaceId: "authorized",
    name: "Post",
    status: "draft",
    bodyDocument: { type: "doc", content: [] },
    bodyPlainText: "Caption",
    version: 1,
    mcpOperationId: null,
    scheduledAt: null,
    scheduledTimezone: "UTC",
    projectId: null,
    createdByUserId: "actor",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.targets.mockResolvedValue([]);
  mocks.connections.mockResolvedValue([]);
  mocks.summaries.mockResolvedValue(
    new Map([
      [
        "post-0",
        {
          mediaCount: 2,
          previewObjectKey: "private/preview.png",
          previewKind: "image",
        },
      ],
    ]),
  );
  mocks.sign.mockResolvedValue("signed-preview");
});
describe("post list loading", () => {
  it.each([1, 50])(
    "uses one summary query for %s posts and skips unused previews",
    async (count) => {
      const posts = Array.from({ length: count }, (_, index) => post(index));
      mocks.posts.mockResolvedValue(posts);
      const view = await loadSocialPostsView({ workspaceId: "authorized" });
      expect(view).toHaveLength(count);
      expect(view[0]).toMatchObject({
        mediaCount: 2,
        mediaPreviewUrl: null,
        mediaKind: null,
      });
      expect(mocks.summaries).toHaveBeenCalledExactlyOnceWith({
        workspaceId: "authorized",
        postIds: posts.map((p) => p.id),
        includePreviews: undefined,
      });
      expect(mocks.targets).toHaveBeenCalledOnce();
      expect(mocks.connections).toHaveBeenCalledOnce();
      expect(mocks.media).not.toHaveBeenCalled();
      expect(mocks.sign).not.toHaveBeenCalled();
    },
  );
  it("signs only the selected preview for a screen that displays it", async () => {
    mocks.posts.mockResolvedValue([post(0), post(1)]);
    const view = await loadSocialPostsView({
      workspaceId: "authorized",
      includePreviews: true,
    });
    expect(view[0]).toMatchObject({
      mediaCount: 2,
      mediaPreviewUrl: "signed-preview",
      mediaKind: "image",
    });
    expect(view[1]).toMatchObject({ mediaCount: 0, mediaPreviewUrl: null });
    expect(mocks.sign).toHaveBeenCalledExactlyOnceWith("private/preview.png");
  });
  it("does no downstream work for an empty collection", async () => {
    mocks.posts.mockResolvedValue([]);
    expect(await loadSocialPostsView({ workspaceId: "authorized" })).toEqual(
      [],
    );
    expect(mocks.summaries).not.toHaveBeenCalled();
    expect(mocks.connections).not.toHaveBeenCalled();
    expect(mocks.targets).not.toHaveBeenCalled();
  });
});
