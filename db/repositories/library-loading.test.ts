import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/db/drizzle", () => ({
  getDatabase: () => ({ select: mocks.select }),
}));
import { listMediaAssetWindow } from "./media-assets.repository";
import {
  listSocialPosts,
  listSocialPostMedia,
  listSocialPostMediaSummaries,
} from "./social-posts.repository";
const chain = {
  from: vi.fn(),
  leftJoin: vi.fn(),
  where: mocks.where,
  orderBy: mocks.orderBy,
  limit: mocks.limit,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  mocks.where.mockReturnValue(chain);
  mocks.orderBy.mockReturnValue(chain);
  mocks.limit.mockResolvedValue([]);
});
function query(condition: SQL) {
  return new PgDialect().sqlToQuery(condition);
}
describe("library keyset query", () => {
  it.each(["next", "previous"] as const)(
    "scopes a %s window and limits it to 24 plus a sentinel",
    async (direction) => {
      await listMediaAssetWindow({
        workspaceId: "authorized",
        kind: "image",
        visualOnly: true,
        cursor: {
          direction,
          id: "boundary-id",
          createdAt: "2026-10-31T12:00:00.000Z",
        },
      });
      const filter = query(mocks.where.mock.calls[0]![0]);
      expect(filter.params).toContain("authorized");
      expect(filter.params).toContain("ready");
      expect(filter.params).toContain("image");
      expect(filter.params).toContain("boundary-id");
      expect(filter.sql).toContain('"deleted_at" is null');
      expect(filter.sql).toContain(
        'coalesce((select "media_assets"."created_at"',
      );
      expect(filter.sql).toContain(direction === "next" ? " < " : " > ");
      const ordering = mocks.orderBy.mock.calls[0]!.map(
        (value: SQL) => query(value).sql,
      ).join(",");
      expect(ordering).toContain(direction === "next" ? "desc" : "asc");
      expect(ordering).toContain('"id"');
      expect(mocks.limit).toHaveBeenCalledExactlyOnceWith(25);
    },
  );
});
describe("post media batch query", () => {
  it("omits rich-text bodies from the bounded post list", async () => {
    await listSocialPosts({ workspaceId: "authorized" });
    expect(mocks.select.mock.calls[0]![0]).not.toHaveProperty("bodyDocument");
    expect(mocks.select.mock.calls[0]![0]).toHaveProperty("bodyPlainText");
    expect(mocks.limit).toHaveBeenCalledWith(50);
    expect(query(mocks.where.mock.calls[0]![0]).params).toEqual(["authorized"]);
  });
  it("keeps heavy render snapshots out of composer attachment reads too", async () => {
    mocks.orderBy.mockResolvedValue([]);
    await listSocialPostMedia({ workspaceId: "authorized", postId: "post" });
    const projection = mocks.select.mock.calls[0]![0];
    expect(projection.render).not.toHaveProperty("inputSnapshot");
    expect(projection.render).not.toHaveProperty("timelineSnapshot");
    expect(projection.render).toHaveProperty("assetObjectKey");
    expect(query(mocks.where.mock.calls[0]![0]).params).toEqual([
      "post",
      "authorized",
    ]);
  });
  it("does no work for an empty post list", async () => {
    expect(
      await listSocialPostMediaSummaries({
        workspaceId: "authorized",
        postIds: [],
      }),
    ).toEqual(new Map());
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("counts unavailable media, skips unresolved sources, and selects the first usable preview", async () => {
    const base = {
      postId: "post",
      assetId: "asset",
      assetKind: "image",
      assetDeletedAt: null,
      assetObjectKey: "private/first.png",
      renderId: null,
      renderStatus: null,
      renderSizeBytes: null,
      renderObjectKey: null,
    };
    mocks.orderBy.mockResolvedValue([
      { ...base, assetDeletedAt: new Date() },
      {
        ...base,
        assetId: null,
        renderId: "render",
        renderStatus: "failed",
        renderSizeBytes: 100,
        renderObjectKey: "private/failed.mp4",
      },
      { ...base, assetId: null, renderId: null },
      base,
      { ...base, assetObjectKey: "private/later.png" },
    ]);
    const summaries = await listSocialPostMediaSummaries({
      workspaceId: "authorized",
      postIds: ["post"],
      includePreviews: true,
    });
    expect(summaries.get("post")).toEqual({
      mediaCount: 4,
      previewObjectKey: "private/first.png",
      previewKind: "image",
    });
    const filter = query(mocks.where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["authorized", "post"]);
    for (const call of chain.leftJoin.mock.calls)
      expect(query(call[1]).sql).toContain('"workspace_id"');
    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.select.mock.calls[0]![0]).not.toHaveProperty("inputSnapshot");
  });
  it("does not project storage keys when previews are unused", async () => {
    mocks.orderBy.mockResolvedValue([]);
    await listSocialPostMediaSummaries({
      workspaceId: "authorized",
      postIds: ["post"],
    });
    const projection = mocks.select.mock.calls[0]![0];
    expect(query(projection.assetObjectKey).sql).toBe("null");
    expect(query(projection.renderObjectKey).sql).toBe("null");
  });
});
