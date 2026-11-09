import { readFile, stat, access } from "node:fs/promises";
import { dirname } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/storage/r2-client", () => ({
  getR2Client: () => ({ send: m.send }),
}));
vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => ({ R2_BUCKET_NAME: "private" }),
}));
import { withMediaAssetFile } from "./with-media-asset-file";
const input = {
  objectKey: "scoped/video.mp4",
  sizeBytes: 12,
  maxBytes: 512 * 1024 * 1024,
  contentType: "video/mp4",
};
function response(parts: Uint8Array[], length = input.sizeBytes) {
  return {
    ContentLength: length,
    Body: {
      transformToByteArray: () => {
        throw new Error("MUST_NOT_BUFFER_VIDEO");
      },
      transformToWebStream: () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
    },
  };
}
beforeEach(() => vi.clearAllMocks());
describe("streaming private video to temporary disk", () => {
  it("preserves bytes and removes the generated directory after use", async () => {
    m.send.mockResolvedValue(
      response([Buffer.from("hello "), Buffer.from("video!")]),
    );
    let source = "";
    await expect(
      withMediaAssetFile(input, async (path) => {
        source = path;
        return (await readFile(path)).toString();
      }),
    ).resolves.toBe("hello video!");
    await expect(access(dirname(source))).rejects.toThrow();
  });
  it("streams a 320 MiB source without using an in-memory collection API", async () => {
    const block = new Uint8Array(1024 * 1024);
    let remaining = 320;
    m.send.mockResolvedValue({
      ContentLength: block.length * remaining,
      Body: {
        transformToByteArray: () => {
          throw new Error("MUST_NOT_BUFFER_VIDEO");
        },
        transformToWebStream: () =>
          new ReadableStream<Uint8Array>(
            {
              pull(controller) {
                if (remaining-- > 0) controller.enqueue(block);
                else controller.close();
              },
            },
            { highWaterMark: 1 },
          ),
      },
    });
    await withMediaAssetFile(
      { ...input, sizeBytes: 320 * block.length },
      async (path) => expect((await stat(path)).size).toBe(320 * block.length),
    );
    expect(remaining).toBe(-1);
  }, 20000);
  it.each([0, 513 * 1024 * 1024])(
    "rejects an invalid source size %s before storage access",
    async (sizeBytes) => {
      await expect(
        withMediaAssetFile({ ...input, sizeBytes }, async () => null),
      ).rejects.toThrow("SIZE_INVALID");
      expect(m.send).not.toHaveBeenCalled();
    },
  );
  it.each([
    [11, 12, "SIZE_CHANGED"],
    [12, 11, "INCOMPLETE"],
    [12, 13, "SIZE_EXCEEDED"],
  ])(
    "rejects a changed or incomplete original",
    async (header, actual, error) => {
      m.send.mockResolvedValue(response([new Uint8Array(actual)], header));
      const use = vi.fn();
      await expect(withMediaAssetFile(input, use)).rejects.toThrow(
        String(error),
      );
      expect(use).not.toHaveBeenCalled();
    },
  );
  it("cleans up after a decoder failure", async () => {
    m.send.mockResolvedValue(response([new Uint8Array(12)]));
    let source = "";
    await expect(
      withMediaAssetFile(input, async (path) => {
        source = path;
        throw new Error("DECODE_FAILED");
      }),
    ).rejects.toThrow("DECODE_FAILED");
    await expect(access(dirname(source))).rejects.toThrow();
  });
});
