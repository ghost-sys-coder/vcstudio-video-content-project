import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
vi.mock("server-only", () => ({}));
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/r2-client", () => ({ getR2Client: () => ({ send }) }));
vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => ({ R2_BUCKET_NAME: "private" }),
}));
import {
  storeMcpChunk,
  readMcpChunks,
  removeMcpChunks,
  listMcpChunks,
} from "./chunk-upload-storage";
import { MCP_UPLOAD_CHUNK_BYTES } from "@studio/contracts/mcp-upload";
import { bytesSha256, uploadFileFingerprint } from "./upload-fingerprint";
const objects = new Map<
  string,
  { bytes: Buffer; metadata: Record<string, string> }
>();
const workspaceId = "11111111-1111-4111-8111-111111111111",
  uploadId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  objects.clear();
  send.mockReset();
  send.mockImplementation(async (command: unknown) => {
    if (command instanceof PutObjectCommand) {
      const { Key, Body, Metadata } = command.input;
      if (!Key || !(Body instanceof Uint8Array))
        throw new Error("invalid fixture");
      if (objects.has(Key)) throw new Error("PreconditionFailed");
      expect(command.input.IfNoneMatch).toBe("*");
      objects.set(Key, { bytes: Buffer.from(Body), metadata: Metadata ?? {} });
      return {};
    }
    if (command instanceof HeadObjectCommand) {
      const item = objects.get(command.input.Key ?? "");
      if (!item) throw new Error("NoSuchKey");
      return { ContentLength: item.bytes.length, Metadata: item.metadata };
    }
    if (command instanceof GetObjectCommand) {
      const item = objects.get(command.input.Key ?? "");
      if (!item) throw new Error("NoSuchKey");
      return {
        ContentLength: item.bytes.length,
        Metadata: item.metadata,
        Body: {
          transformToWebStream: () =>
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(item.bytes);
                controller.close();
              },
            }),
        },
      };
    }
    if (command instanceof ListObjectsV2Command)
      return {
        Contents: [...objects]
          .filter(([key]) => key.startsWith(command.input.Prefix ?? ""))
          .map(([Key, item]) => ({ Key, Size: item.bytes.length })),
        IsTruncated: false,
      };
    if (command instanceof DeleteObjectsCommand) {
      for (const object of command.input.Delete?.Objects ?? [])
        objects.delete(object.Key ?? "");
      return {};
    }
    throw new Error("Unexpected storage command");
  });
});
async function put(index: number, bytes: Buffer) {
  const sha256 = await bytesSha256(bytes);
  await storeMcpChunk({
    workspaceId,
    uploadId,
    index,
    bytes,
    sha256,
    idempotencyKey: `part-${index}-${sha256}`,
  });
  return sha256;
}
async function collect(body: AsyncIterable<Uint8Array>) {
  const parts: Buffer[] = [];
  for await (const bytes of body) parts.push(Buffer.from(bytes));
  return Buffer.concat(parts);
}
describe("immutable bounded R2 upload chunks", () => {
  it("reuses only identical retries and cannot overwrite a different part", async () => {
    const bytes = Buffer.from("abc"),
      sha256 = await bytesSha256(bytes);
    await put(0, bytes);
    expect(
      await storeMcpChunk({
        workspaceId,
        uploadId,
        index: 0,
        bytes,
        sha256,
        idempotencyKey: `part-0-${sha256}`,
      }),
    ).toEqual({ reused: true });
    await expect(put(0, Buffer.from("xyz"))).rejects.toThrow("different bytes");
    expect([...objects.values()][0].bytes).toEqual(bytes);
  });
  it("assembles original bytes with both per-chunk and whole-file fingerprint checks", async () => {
    const first = Buffer.alloc(MCP_UPLOAD_CHUNK_BYTES, 6),
      second = Buffer.from("tail"),
      hashes = [await put(0, first), await put(1, second)];
    const sizeBytes = first.length + second.length,
      fileFingerprint = await uploadFileFingerprint(
        sizeBytes,
        MCP_UPLOAD_CHUNK_BYTES,
        hashes,
      );
    const actual = await collect(
      readMcpChunks({ workspaceId, uploadId, sizeBytes, fileFingerprint }),
    );
    expect(actual.equals(Buffer.concat([first, second]))).toBe(true);
    expect(await listMcpChunks(workspaceId, uploadId)).toMatchObject([
      { index: 0, size: first.length },
      { index: 1, size: 4 },
    ]);
    expect(createHash("sha256").update(Buffer.from("abc")).digest("hex")).toBe(
      await bytesSha256(Buffer.from("abc")),
    );
  });
  it("fails truncated, tampered and mixed-file content before import completion", async () => {
    const digest = await put(0, Buffer.from("abc")),
      fileFingerprint = await uploadFileFingerprint(3, MCP_UPLOAD_CHUNK_BYTES, [
        digest,
      ]);
    await expect(
      collect(
        readMcpChunks({ workspaceId, uploadId, sizeBytes: 4, fileFingerprint }),
      ),
    ).rejects.toThrow("wrong size");
    const entry = [...objects.values()][0];
    entry.bytes = Buffer.from("xyz");
    await expect(
      collect(
        readMcpChunks({ workspaceId, uploadId, sizeBytes: 3, fileFingerprint }),
      ),
    ).rejects.toThrow("integrity");
    entry.metadata.sha256 = await bytesSha256(entry.bytes);
    await expect(
      collect(
        readMcpChunks({ workspaceId, uploadId, sizeBytes: 3, fileFingerprint }),
      ),
    ).rejects.toThrow("differs from");
  });
  it("cleans only the exact tenant/upload prefix", async () => {
    await put(0, Buffer.from("abc"));
    objects.set(`workspaces/${workspaceId}/mcp-uploads/another/chunk-0000`, {
      bytes: Buffer.from("safe"),
      metadata: {},
    });
    await removeMcpChunks(workspaceId, uploadId);
    expect(objects.size).toBe(1);
    expect([...objects.keys()][0]).toContain("another");
  });
  it("rejects an oversized response body independently of claimed length", async () => {
    const digest = await put(0, Buffer.from("abc"));
    send.mockImplementationOnce(async () => ({
      ContentLength: 3,
      Metadata: { sha256: digest },
      Body: {
        transformToWebStream: () =>
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(Buffer.alloc(4));
              c.close();
            },
          }),
      },
    }));
    await expect(
      collect(
        readMcpChunks({
          workspaceId,
          uploadId,
          sizeBytes: 3,
          fileFingerprint: "a".repeat(64),
        }),
      ),
    ).rejects.toThrow("exceeds");
  });
});
