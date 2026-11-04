import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/r2-client", () => ({ getR2Client: () => ({ send }) }));
vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => ({ R2_BUCKET_NAME: "private" }),
}));
import { streamImportObject } from "./import-storage";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
beforeEach(() => {
  send.mockReset();
  send.mockImplementation(async (command) =>
    command instanceof CreateMultipartUploadCommand
      ? { UploadId: "upload" }
      : command instanceof UploadPartCommand
        ? { ETag: "part" }
        : {},
  );
});
async function* chunks(...sizes: number[]) {
  for (const size of sizes) yield new Uint8Array(size);
}
describe("bounded private imports", () => {
  it("streams into bounded multipart chunks before committing", async () => {
    const size = await streamImportObject({
      objectKey: "workspace/import",
      contentType: "video/mp4",
      maximumBytes: 8_000_000,
      body: chunks(3_000_000, 3_000_000),
    });
    expect(size).toBe(6_000_000);
    const parts = send.mock.calls
      .map(([c]) => c)
      .filter((c) => c instanceof UploadPartCommand);
    expect(parts.map((c) => c.input.ContentLength)).toEqual([
      5 * 1024 * 1024,
      6_000_000 - 5 * 1024 * 1024,
    ]);
    expect(
      send.mock.calls.some(
        ([c]) => c instanceof CompleteMultipartUploadCommand,
      ),
    ).toBe(true);
  });
  it("aborts oversized, empty and interrupted transfers without committing a usable object", async () => {
    async function* interrupted() {
      yield new Uint8Array(10);
      throw new Error("network interrupted");
    }
    for (const body of [chunks(101), chunks(0), interrupted()]) {
      send.mockClear();
      await expect(
        streamImportObject({
          objectKey: "workspace/import",
          contentType: "image/png",
          maximumBytes: 100,
          body,
        }),
      ).rejects.toThrow();
      expect(
        send.mock.calls.some(([c]) => c instanceof AbortMultipartUploadCommand),
      ).toBe(true);
      expect(
        send.mock.calls.some(
          ([c]) => c instanceof CompleteMultipartUploadCommand,
        ),
      ).toBe(false);
    }
  });
});
