import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ execute: vi.fn(), read: vi.fn() }));
vi.mock("node:child_process", async (original) => {
  const actual = await original<typeof import("node:child_process")>();
  const { promisify } = await import("node:util");
  return {
    ...actual,
    execFile: Object.assign(vi.fn(), { [promisify.custom]: m.execute }),
  };
});
vi.mock("node:fs/promises", async (original) => ({
  ...(await original<typeof import("node:fs/promises")>()),
  readFile: m.read,
}));
import { extractVideoThumbnail } from "./extract-video-thumbnail";

const input = {
  source: "C:/temp/my video;name.mp4",
  directory: "C:/temp",
  ffmpegPath: "ffmpeg",
  durationMilliseconds: 8000,
};
beforeEach(async () => {
  vi.clearAllMocks();
  m.execute.mockResolvedValue({ stdout: "" });
  m.read.mockResolvedValue(
    await sharp({
      create: { width: 640, height: 360, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer(),
  );
});
describe("bounded video frame extraction", () => {
  it("extracts one bounded JPEG with local protocols, a timeout and argument arrays", async () => {
    const result = await extractVideoThumbnail(input);
    expect(result).toMatchObject({
      width: 640,
      height: 360,
      timestampMilliseconds: 1000,
    });
    const [command, args, options] = m.execute.mock.calls[0];
    expect(command).toBe("ffmpeg");
    expect(args).toEqual(
      expect.arrayContaining([
        input.source,
        "file,pipe",
        "-frames:v",
        "1",
        "-ss",
        "1",
      ]),
    );
    expect(options).toMatchObject({ timeout: 30000, windowsHide: true });
    expect(options).not.toHaveProperty("shell");
    expect(m.execute).toHaveBeenCalledOnce();
  });
  it("chooses a frame inside a very short video", async () => {
    expect(
      (await extractVideoThumbnail({ ...input, durationMilliseconds: 200 }))
        .timestampMilliseconds,
    ).toBe(50);
  });
  it.each([
    Buffer.alloc(0),
    Buffer.alloc(512 * 1024 + 1),
    Buffer.from("not a JPEG"),
  ])("rejects empty, oversized or disguised output", async (bytes) => {
    m.read.mockResolvedValue(bytes);
    await expect(extractVideoThumbnail(input)).rejects.toThrow();
  });
  it("does not retry extraction failures automatically", async () => {
    m.execute.mockRejectedValue(new Error("decoder failed"));
    await expect(extractVideoThumbnail(input)).rejects.toThrow();
    expect(m.read).not.toHaveBeenCalled();
    expect(m.execute).toHaveBeenCalledOnce();
  });
});
