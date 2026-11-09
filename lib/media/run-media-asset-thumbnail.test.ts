import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  find: vi.fn(),
  save: vi.fn(),
  inspect: vi.fn(),
  store: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.find,
}));
vi.mock("@/db/commands/media-inspection-commands", () => ({
  saveMediaAssetThumbnail: m.save,
}));
vi.mock("@/lib/media/inspect-media-file", () => ({
  inspectMediaFile: m.inspect,
}));
vi.mock("@/lib/media/store-video-thumbnail", () => ({
  storeVideoThumbnail: m.store,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  downloadMediaAssetBytes: m.download,
}));
vi.mock("@/lib/env/server", () => ({
  getMediaLibraryEnvironment: () => ({ MAX_MEDIA_VIDEO_BYTES: 10000 }),
  getSceneAudioEnvironment: () => ({
    FFMPEG_PATH: "ffmpeg",
    FFPROBE_PATH: "ffprobe",
  }),
}));
import { runMediaAssetThumbnail } from "./run-media-asset-thumbnail";

const input = { workspaceId: "workspace", mediaAssetId: "asset" };
const asset = {
  id: "asset",
  workspaceId: "workspace",
  kind: "video",
  status: "ready",
  inspectionStatus: "succeeded",
  verifiedMetadata: null,
  deletedAt: null,
  objectKey: "private.mp4",
  contentType: "video/mp4",
  sizeBytes: 5,
};
const thumbnail = {
  version: 1,
  width: 640,
  height: 360,
  timestampMilliseconds: 1000,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.find.mockResolvedValue(asset);
  m.download.mockResolvedValue(Buffer.from("video"));
  m.inspect.mockResolvedValue({
    metadata: { kind: "video", codec: "h264" },
    thumbnail: { bytes: Buffer.from("jpg"), ...thumbnail },
  });
  m.store.mockResolvedValue(thumbnail);
  m.save.mockResolvedValue(true);
});
describe("provider-free thumbnail worker", () => {
  it("inspects an existing video, stores a derivative and saves only its preview metadata", async () => {
    expect(await runMediaAssetThumbnail(input)).toEqual({
      status: "succeeded",
    });
    expect(m.find).toHaveBeenCalledExactlyOnceWith(input);
    expect(m.inspect).toHaveBeenCalledWith(
      expect.objectContaining({ createThumbnail: true, expectedKind: "video" }),
    );
    expect(m.save).toHaveBeenCalledWith({
      ...input,
      metadata: { kind: "video", codec: "h264" },
      thumbnail,
    });
  });
  it("returns the existing result without downloading or processing again", async () => {
    m.find.mockResolvedValue({
      ...asset,
      verifiedMetadata: { kind: "video", thumbnail },
    });
    expect(await runMediaAssetThumbnail(input)).toEqual({
      status: "succeeded",
    });
    expect(m.download).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ...asset, deletedAt: new Date() },
    { ...asset, kind: "image" },
    { ...asset, inspectionStatus: "pending" },
  ])("rejects unavailable assets before storage reads", async (value) => {
    m.find.mockResolvedValue(value);
    expect(await runMediaAssetThumbnail(input)).toEqual({ status: "failed" });
    expect(m.download).not.toHaveBeenCalled();
  });
  it("leaves the original video and inspection state alone when preview processing fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.inspect.mockRejectedValue(new Error("private decoder details"));
    expect(await runMediaAssetThumbnail(input)).toEqual({ status: "failed" });
    expect(m.save).not.toHaveBeenCalled();
    expect(m.store).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "Media library video thumbnail could not be created.",
    );
    warn.mockRestore();
  });
});
