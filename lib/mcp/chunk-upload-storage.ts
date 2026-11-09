import "server-only";
import { createHash } from "node:crypto";
import {
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/storage/r2-client";
import { getStorageEnvironment } from "@/lib/env/server";
import {
  MCP_UPLOAD_CHUNK_BYTES,
  MCP_UPLOAD_MAX_CHUNKS,
} from "@studio/contracts/mcp-upload";
import { McpError, requireMcp } from "./errors";
import { uploadFileFingerprint } from "./upload-fingerprint";

function prefix(workspaceId: string, uploadId: string) {
  return `workspaces/${workspaceId}/mcp-uploads/${uploadId}/`;
}
function key(workspaceId: string, uploadId: string, index: number) {
  return `${prefix(workspaceId, uploadId)}chunk-${String(index).padStart(4, "0")}`;
}
const bucket = () => getStorageEnvironment().R2_BUCKET_NAME;
export async function storeMcpChunk(input: {
  workspaceId: string;
  uploadId: string;
  index: number;
  bytes: Buffer;
  sha256: string;
  idempotencyKey: string;
}) {
  const client = getR2Client(),
    Key = key(input.workspaceId, input.uploadId, input.index);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key,
        Body: input.bytes,
        ContentType: "application/octet-stream",
        ContentLength: input.bytes.length,
        IfNoneMatch: "*",
        Metadata: {
          sha256: input.sha256,
          request: createHash("sha256")
            .update(input.idempotencyKey)
            .digest("hex"),
        },
      }),
    );
    return { reused: false };
  } catch (error) {
    // An ambiguous PUT can have committed. Only the identical immutable part is reusable.
    try {
      const existing = await client.send(
        new HeadObjectCommand({ Bucket: bucket(), Key }),
      );
      requireMcp(
        existing.ContentLength === input.bytes.length &&
          existing.Metadata?.sha256 === input.sha256 &&
          existing.Metadata?.request ===
            createHash("sha256").update(input.idempotencyKey).digest("hex"),
        "conflict",
        "This chunk already contains different bytes. Start a new upload for a different file.",
      );
      return { reused: true };
    } catch (checkError) {
      if (checkError instanceof McpError) throw checkError;
      throw error;
    }
  }
}
export async function listMcpChunks(workspaceId: string, uploadId: string) {
  const Prefix = prefix(workspaceId, uploadId),
    items: { index: number; size: number; key: string }[] = [];
  let continuation: string | undefined;
  for (let page = 0; page < 2; page++) {
    const result = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix,
        MaxKeys: 1000,
        ContinuationToken: continuation,
      }),
    );
    for (const object of result.Contents ?? []) {
      const suffix = object.Key?.slice(Prefix.length) ?? "";
      if (!/^chunk-\d{4}$/.test(suffix) || !object.Key)
        throw new McpError(
          "invalid_file",
          "The upload has unexpected staging data.",
        );
      const index = Number(suffix.slice(6));
      requireMcp(
        index < MCP_UPLOAD_MAX_CHUNKS,
        "invalid_file",
        "The upload contains too many chunks.",
      );
      items.push({ index, size: object.Size ?? 0, key: object.Key });
    }
    if (!result.IsTruncated) return items.sort((a, b) => a.index - b.index);
    continuation = result.NextContinuationToken;
    requireMcp(
      continuation,
      "storage_unavailable",
      "Upload status could not be read.",
    );
  }
  throw new McpError(
    "invalid_file",
    "The upload contains too much staging data.",
  );
}
export async function removeMcpChunks(workspaceId: string, uploadId: string) {
  const objects = await listMcpChunks(workspaceId, uploadId);
  for (let start = 0; start < objects.length; start += 1000) {
    const result = await getR2Client().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: {
          Objects: objects
            .slice(start, start + 1000)
            .map((item) => ({ Key: item.key })),
          Quiet: true,
        },
      }),
    );
    requireMcp(
      !result.Errors?.length,
      "storage_unavailable",
      "Some upload chunks could not be cleaned up.",
    );
  }
}
export async function removeMcpChunk(
  workspaceId: string,
  uploadId: string,
  index: number,
) {
  const result = await getR2Client().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: {
        Objects: [{ Key: key(workspaceId, uploadId, index) }],
        Quiet: true,
      },
    }),
  );
  requireMcp(
    !result.Errors?.length,
    "storage_unavailable",
    "The late upload chunk could not be cleaned up.",
  );
}
export async function* readMcpChunks(input: {
  workspaceId: string;
  uploadId: string;
  sizeBytes: number;
  fileFingerprint: string;
}) {
  const count = Math.ceil(input.sizeBytes / MCP_UPLOAD_CHUNK_BYTES),
    hashes: string[] = [];
  for (let index = 0; index < count; index++) {
    const result = await getR2Client().send(
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key(input.workspaceId, input.uploadId, index),
      }),
    );
    requireMcp(
      result.Body,
      "invalid_file",
      "An upload chunk is missing. Resume the upload before completing it.",
    );
    const expected = Math.min(
      MCP_UPLOAD_CHUNK_BYTES,
      input.sizeBytes - index * MCP_UPLOAD_CHUNK_BYTES,
    );
    requireMcp(
      result.ContentLength === expected,
      "invalid_file",
      "An upload chunk has the wrong size.",
    );
    // Bound the body independently of its untrusted Content-Length.
    const pieces: Buffer[] = [];
    let length = 0;
    const reader = result.Body.transformToWebStream().getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        const piece: unknown = next.value;
        requireMcp(
          piece instanceof Uint8Array,
          "invalid_file",
          "An upload chunk contains invalid bytes.",
        );
        length += piece.byteLength;
        requireMcp(
          length <= expected,
          "file_too_large",
          "An upload chunk exceeds its declared size.",
        );
        pieces.push(Buffer.from(piece));
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    requireMcp(
      length === expected,
      "invalid_file",
      "An upload chunk was interrupted.",
    );
    const bytes = Buffer.concat(pieces),
      digest = createHash("sha256").update(bytes).digest("hex");
    requireMcp(
      digest === result.Metadata?.sha256,
      "invalid_file",
      "An upload chunk failed its integrity check.",
    );
    hashes.push(digest);
    yield bytes;
  }
  requireMcp(
    (await uploadFileFingerprint(
      input.sizeBytes,
      MCP_UPLOAD_CHUNK_BYTES,
      hashes,
    )) === input.fileFingerprint,
    "invalid_file",
    "The upload differs from the selected file. Start a fresh upload for that file.",
  );
}
