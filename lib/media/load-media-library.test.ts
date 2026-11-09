import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "@/db/schema";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  window: vi.fn(),
  count: vi.fn(),
  sign: vi.fn(),
  outstanding: vi.fn(),
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  listMediaAssetWindow: mocks.window,
  countMediaAssets: mocks.count,
  listOutstandingMediaAssets: mocks.outstanding,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  createMediaAssetDownloadUrl: mocks.sign,
}));
import { loadMediaLibrary, loadMediaLibraryPage } from "./load-media-library";
import { decodeLibraryCursor, encodeLibraryCursor } from "./library-cursor";
import { verifiedVideoMetadataSchema } from "./media-inspection";

function asset(index: number): MediaAsset {
  return {
    id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    workspaceId: "22222222-2222-4222-8222-222222222222",
    kind: "image",
    status: "ready",
    objectKey: `private/${index}.png`,
    contentType: "image/png",
    sizeBytes: 100,
    originalFileName: `${index}.png`,
    title: `Image ${index}`,
    altText: "",
    tags: [],
    width: 800,
    height: 600,
    durationMilliseconds: null,
    inspectionStatus: null,
    verifiedMetadata: null,
    inspectionWarnings: [],
    inspectionTriggerRunId: null,
    inspectionError: null,
    inspectedAt: null,
    uploadedByUserId: "actor",
    deletedAt: null,
    createdAt: new Date(
      `2026-10-31T12:00:${String(index).padStart(2, "0")}.000Z`,
    ),
    updatedAt: new Date(),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.count.mockResolvedValue(80);
  mocks.outstanding.mockResolvedValue([]);
  mocks.sign.mockImplementation(async (key: string) => `signed:${key}`);
});
describe("bounded media library loading", () => {
  it("keeps transferred videos visible without signing their unverified source", async () => {
    mocks.window.mockResolvedValue([asset(1)]);
    mocks.outstanding.mockResolvedValue([
      {
        ...asset(2),
        kind: "video",
        status: "pending",
        inspectionStatus: "pending",
      },
    ]);
    const view = await loadMediaLibrary({ workspaceId: "authorized" });
    expect(mocks.outstanding).toHaveBeenCalledExactlyOnceWith({
      workspaceId: "authorized",
    });
    expect(view.processingAssets).toMatchObject([
      { id: asset(2).id, inspectionPending: true, previewUrl: "" },
    ]);
    expect(mocks.sign).toHaveBeenCalledExactlyOnceWith("private/1.png");
  });
  it("signs a separate JPEG only for ready videos with a persisted thumbnail", async () => {
    const video = {
      ...asset(1),
      kind: "video" as const,
      verifiedMetadata: verifiedVideoMetadataSchema.parse({
        kind: "video",
        durationMilliseconds: 8000,
        container: "mp4",
        codec: "h264",
        width: 1920,
        height: 1080,
        displayWidth: 1920,
        displayHeight: 1080,
        rotationDegrees: 0,
        averageFrameRate: 30,
        variableFrameRate: false,
        hasAudio: false,
        audioCodec: null,
        thumbnail: {
          version: 1,
          width: 640,
          height: 360,
          timestampMilliseconds: 1000,
        },
      }),
    };
    mocks.window.mockResolvedValue([video]);
    const page = await loadMediaLibraryPage({ workspaceId: video.workspaceId });
    expect(page.assets[0]).toMatchObject({
      previewUrl: "signed:private/1.png",
      thumbnailUrl: `signed:workspaces/${video.workspaceId}/library/${video.id}/poster-v1.jpg`,
    });
    expect(mocks.sign).toHaveBeenCalledTimes(2);
    expect(page.assets[0]).not.toHaveProperty("objectKey");
    expect(page.assets[0]?.verifiedMetadata).not.toHaveProperty("objectKey");
  });
  it("avoids a total-count query for picker pages", async () => {
    mocks.window.mockResolvedValue([asset(1)]);
    expect(
      (
        await loadMediaLibraryPage({
          workspaceId: "authorized",
          visualOnly: true,
        })
      ).assets,
    ).toHaveLength(1);
    expect(mocks.count).not.toHaveBeenCalled();
  });
  it.each(["next", "previous"] as const)(
    "retains an escape from a %s page emptied by deletion",
    async (direction) => {
      mocks.window.mockResolvedValue([]);
      const cursor = encodeLibraryCursor({
        id: asset(1).id,
        createdAt: asset(1).createdAt.toISOString(),
        direction,
      });
      const view = await loadMediaLibraryPage({
        workspaceId: "authorized",
        cursor,
      });
      const back = direction === "next" ? view.previousCursor : view.nextCursor;
      expect(decodeLibraryCursor(back ?? undefined)?.direction).toBe(
        direction === "next" ? "previous" : "next",
      );
    },
  );
  it("signs only 24 visible assets and never the sentinel", async () => {
    mocks.window.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => asset(25 - i)),
    );
    const view = await loadMediaLibrary({
      workspaceId: "authorized",
      kind: "image",
    });
    expect(view.assets).toHaveLength(24);
    expect(mocks.sign).toHaveBeenCalledTimes(24);
    expect(mocks.sign).not.toHaveBeenCalledWith("private/1.png");
    expect(view.previousCursor).toBeNull();
    expect(decodeLibraryCursor(view.nextCursor ?? undefined)).toMatchObject({
      id: asset(2).id,
      direction: "next",
    });
    expect(mocks.window).toHaveBeenCalledWith({
      workspaceId: "authorized",
      kind: "image",
      cursor: null,
      visualOnly: undefined,
    });
    expect(view.assets[0]).not.toHaveProperty("objectKey");
  });
  it("reverses the previous window after removing its sentinel", async () => {
    mocks.window.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => asset(i + 1)),
    );
    const cursor = encodeLibraryCursor({
      id: asset(26).id,
      createdAt: asset(26).createdAt.toISOString(),
      direction: "previous",
    });
    const view = await loadMediaLibrary({
      workspaceId: "authorized",
      cursor,
      visualOnly: true,
    });
    expect(view.assets[0]?.id).toBe(asset(24).id);
    expect(view.assets[23]?.id).toBe(asset(1).id);
    expect(
      decodeLibraryCursor(view.previousCursor ?? undefined)?.direction,
    ).toBe("previous");
    expect(decodeLibraryCursor(view.nextCursor ?? undefined)?.direction).toBe(
      "next",
    );
    expect(mocks.count).toHaveBeenCalledWith({
      workspaceId: "authorized",
      kind: undefined,
      visualOnly: true,
    });
  });
  it("ends forward pagination without dropping the back link", async () => {
    mocks.window.mockResolvedValue([asset(1)]);
    const cursor = encodeLibraryCursor({
      id: asset(2).id,
      createdAt: asset(2).createdAt.toISOString(),
      direction: "next",
    });
    const view = await loadMediaLibrary({ workspaceId: "authorized", cursor });
    expect(view.nextCursor).toBeNull();
    expect(view.previousCursor).toBeTruthy();
  });
  it("falls back on invalid cursors and does no signing for an empty library", async () => {
    mocks.window.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    expect(
      await loadMediaLibrary({
        workspaceId: "authorized",
        cursor: "malformed",
      }),
    ).toMatchObject({
      assets: [],
      nextCursor: null,
      previousCursor: null,
      total: 0,
    });
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.window.mock.calls[0]?.[0].cursor).toBeNull();
  });
});
