import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ execute: vi.fn(), extract: vi.fn() }));
vi.mock("node:child_process", async (original) => {
  const actual = await original<typeof import("node:child_process")>();
  const { promisify } = await import("node:util");
  return {
    ...actual,
    execFile: Object.assign(vi.fn(), { [promisify.custom]: m.execute }),
  };
});
vi.mock("@/lib/media/extract-video-thumbnail", () => ({
  extractVideoThumbnail: m.extract,
}));
import { inspectMediaFile } from "./inspect-media-file";
const input = {
  bytes: Buffer.from("test-only-video"),
  extension: "mp4",
  expectedKind: "video" as const,
  ffprobePath: "mock-probe",
  ffmpegPath: "mock-ffmpeg",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.execute.mockResolvedValue({
    stdout: JSON.stringify({
      format: { duration: "8", format_name: "mp4" },
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          width: 1920,
          height: 1080,
          avg_frame_rate: "30/1",
          r_frame_rate: "30/1",
        },
      ],
    }),
  });
  m.extract.mockResolvedValue({
    bytes: Buffer.from("jpeg"),
    width: 640,
    height: 360,
    timestampMilliseconds: 1000,
  });
});
describe("optional thumbnail during existing inspection", () => {
  it("reuses the inspector's local source for a single preview", async () => {
    const result = await inspectMediaFile({ ...input, createThumbnail: true });
    expect(result.thumbnail).toMatchObject({ width: 640, height: 360 });
    expect(m.extract).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        durationMilliseconds: 8000,
        ffmpegPath: "mock-ffmpeg",
      }),
    );
    expect(m.execute).toHaveBeenCalledOnce();
  });
  it("keeps successful video verification when thumbnail extraction fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.extract.mockRejectedValue(new Error("decoder failure"));
    const result = await inspectMediaFile({ ...input, createThumbnail: true });
    expect(result.metadata).toMatchObject({
      kind: "video",
      codec: "h264",
      durationMilliseconds: 8000,
    });
    expect(result.thumbnail).toBeUndefined();
    warn.mockRestore();
  });
  it("does no thumbnail work for callers that did not request one", async () => {
    expect((await inspectMediaFile(input)).thumbnail).toBeUndefined();
    expect(m.extract).not.toHaveBeenCalled();
  });
});
