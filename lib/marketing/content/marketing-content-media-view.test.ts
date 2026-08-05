import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  attachments: [] as {
    contentItemId: string;
    mediaAssetId: string;
    position: number;
  }[],
  assets: [] as Record<string, unknown>[],
}));

vi.mock("@/db/repositories/marketing-content.repository", () => ({
  listMarketingContentMediaForItems: async () => state.attachments,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findReadyMediaAssets: async () => state.assets,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  createMediaAssetDownloadUrl: async (objectKey: string) =>
    `signed:${objectKey}`,
}));

import {
  loadMarketingContentMediaView,
  loadMarketingContentMediaViews,
} from "@/lib/marketing/content/marketing-content-media-view";

function asset(id: string, objectKey: string) {
  return {
    id,
    workspaceId: "workspace-1",
    kind: "image" as const,
    status: "ready" as const,
    source: "generated" as const,
    title: "Generated graphic",
    altText: "Generated social graphic",
    tags: [],
    objectKey,
    contentType: "image/png",
    sizeBytes: 100,
    width: 1024,
    height: 1024,
    durationMilliseconds: null,
    originalFileName: "graphic.png",
    uploadedByUserId: null,
    createdAt: new Date("2026-08-05T00:00:00Z"),
    updatedAt: new Date("2026-08-05T00:00:00Z"),
    deletedAt: null,
  };
}

describe("loadMarketingContentMediaView", () => {
  beforeEach(() => {
    state.attachments = [];
    state.assets = [];
  });

  it("returns signed previews in attachment order", async () => {
    state.attachments = [
      { contentItemId: "content-1", mediaAssetId: "asset-b", position: 0 },
      { contentItemId: "content-1", mediaAssetId: "asset-a", position: 1 },
    ];
    state.assets = [asset("asset-a", "a.png"), asset("asset-b", "b.png")];

    const result = await loadMarketingContentMediaView({
      workspaceId: "workspace-1",
      contentItemId: "content-1",
    });

    expect(result.map((item) => item.id)).toEqual(["asset-b", "asset-a"]);
    expect(result.map((item) => item.previewUrl)).toEqual([
      "signed:b.png",
      "signed:a.png",
    ]);
  });

  it("omits an attachment whose asset is no longer ready", async () => {
    state.attachments = [
      { contentItemId: "content-1", mediaAssetId: "missing", position: 0 },
    ];

    await expect(
      loadMarketingContentMediaView({
        workspaceId: "workspace-1",
        contentItemId: "content-1",
      }),
    ).resolves.toEqual([]);
  });

  it("groups a batched result by content item", async () => {
    state.attachments = [
      { contentItemId: "content-1", mediaAssetId: "asset-a", position: 0 },
      { contentItemId: "content-2", mediaAssetId: "asset-b", position: 0 },
    ];
    state.assets = [asset("asset-b", "b.png"), asset("asset-a", "a.png")];

    const result = await loadMarketingContentMediaViews({
      workspaceId: "workspace-1",
      contentItemIds: ["content-1", "content-2", "content-3"],
    });

    expect(result["content-1"]?.map((item) => item.id)).toEqual(["asset-a"]);
    expect(result["content-2"]?.map((item) => item.id)).toEqual(["asset-b"]);
    expect(result["content-3"]).toEqual([]);
  });
});
