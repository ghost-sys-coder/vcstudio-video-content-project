import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/storage/r2-client";
import { getStorageEnvironment } from "@/lib/env/server";
import { McpError } from "./errors";
export async function streamImportObject(input: {
  objectKey: string;
  contentType: string;
  maximumBytes: number;
  body: AsyncIterable<Uint8Array>;
}) {
  const client = getR2Client();
  const Bucket = getStorageEnvironment().R2_BUCKET_NAME;
  const created = await client.send(
    new CreateMultipartUploadCommand({
      Bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    }),
  );
  if (!created.UploadId)
    throw new McpError("storage_unavailable", "The file could not be stored.");
  const UploadId = created.UploadId;
  let size = 0;
  let pending = Buffer.alloc(0);
  const parts: { ETag: string; PartNumber: number }[] = [];
  async function putPart(bytes: Buffer) {
    const PartNumber = parts.length + 1;
    const part = await client.send(
      new UploadPartCommand({
        Bucket,
        Key: input.objectKey,
        UploadId,
        PartNumber,
        Body: bytes,
        ContentLength: bytes.length,
      }),
    );
    if (!part.ETag) throw new Error("MCP_PART_ETAG_MISSING");
    parts.push({ PartNumber, ETag: part.ETag });
  }
  try {
    for await (const chunk of input.body) {
      size += chunk.byteLength;
      if (size > input.maximumBytes)
        throw new McpError(
          "file_too_large",
          "The file exceeds this workspace's upload limit.",
        );
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 5 * 1024 * 1024) {
        await putPart(pending.subarray(0, 5 * 1024 * 1024));
        pending = pending.subarray(5 * 1024 * 1024);
      }
    }
    if (!size) throw new McpError("empty_file", "That file is empty.");
    if (pending.length) await putPart(pending);
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket,
        Key: input.objectKey,
        UploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
    return size;
  } catch (error) {
    await client
      .send(
        new AbortMultipartUploadCommand({
          Bucket,
          Key: input.objectKey,
          UploadId,
        }),
      )
      .catch(() => {
        console.error(
          "MCP multipart abort failed; bucket lifecycle cleanup is required.",
          { objectKey: input.objectKey },
        );
      });
    throw error;
  }
}
