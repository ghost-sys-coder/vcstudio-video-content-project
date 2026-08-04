import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  item: null as Record<string, unknown> | null,
  media: [] as { mediaAssetId: string }[],
  ready: [] as { id: string }[],
  created: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({ ENABLE_SOCIAL_POSTING: true }),
}));
vi.mock("@/db/repositories/marketing-content.repository", () => ({
  findMarketingContentItem: async () => state.item,
  listMarketingContentMedia: async () => state.media,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findReadyMediaAssets: async () => state.ready,
}));
vi.mock("@/db/commands/social-post-commands", () => ({
  createSocialPostForContentItem: async (input: Record<string, unknown>) => {
    state.created.push(input);
    return { id: "post-1" };
  },
}));
import {
  createPostFromContentItem,
  MarketingContentHandoffError,
} from "@/lib/marketing/publish/create-post-from-content-item";
const document = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph" as const,
      content: [{ type: "text" as const, text: "Hello" }],
    },
  ],
};
describe("createPostFromContentItem", () => {
  beforeEach(() => {
    state.item = {
      id: "item-1",
      status: "approved",
      kind: "social_post",
      socialPostId: null,
      title: "Launch",
      bodyDocument: document,
    };
    state.media = [];
    state.ready = [];
    state.created = [];
  });
  it.each(["draft", "changes_requested", "needs_review"])(
    "refuses %s content",
    async (status) => {
      state.item = { ...state.item, status };
      await expect(
        createPostFromContentItem({
          workspaceId: "ws",
          contentItemId: "item-1",
          createdByUserId: "user",
        }),
      ).rejects.toBeInstanceOf(MarketingContentHandoffError);
    },
  );
  it.each(["ad_creative", "blog_post", "email", "newsletter"])(
    "refuses export-only %s",
    async (kind) => {
      state.item = { ...state.item, kind };
      await expect(
        createPostFromContentItem({
          workspaceId: "ws",
          contentItemId: "item-1",
          createdByUserId: "user",
        }),
      ).rejects.toBeInstanceOf(MarketingContentHandoffError);
    },
  );
  it("re-verifies assets and derives plain text on the server", async () => {
    state.media = [{ mediaAssetId: "asset-1" }];
    state.ready = [{ id: "asset-1" }];
    const result = await createPostFromContentItem({
      workspaceId: "ws",
      contentItemId: "item-1",
      createdByUserId: "user",
    });
    expect(result.postId).toBe("post-1");
    expect(state.created[0]).toMatchObject({
      workspaceId: "ws",
      contentItemId: "item-1",
      bodyPlainText: "Hello",
      mediaAssetIds: ["asset-1"],
    });
  });
  it("refuses an unavailable or foreign asset", async () => {
    state.media = [{ mediaAssetId: "asset-1" }];
    await expect(
      createPostFromContentItem({
        workspaceId: "ws",
        contentItemId: "item-1",
        createdByUserId: "user",
      }),
    ).rejects.toBeInstanceOf(MarketingContentHandoffError);
  });
});
