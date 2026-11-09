import "server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

/** Stream a bounded original to private temporary disk; never materialize the video in RAM. */
export async function withMediaAssetFile<T>(
  input: {
    objectKey: string;
    sizeBytes: number;
    maxBytes: number;
    contentType: string;
  },
  inspectFile: (sourcePath: string) => Promise<T>,
): Promise<T> {
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > input.maxBytes
  )
    throw new Error("MEDIA_SOURCE_SIZE_INVALID");
  const environment = getStorageEnvironment();
  const directory = await mkdtemp(join(tmpdir(), "vcstudio-video-"));
  const extension =
    input.contentType === "video/webm"
      ? "webm"
      : input.contentType === "video/quicktime"
        ? "mov"
        : "mp4";
  const source = join(directory, `source.${extension}`);
  try {
    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: environment.R2_BUCKET_NAME,
        Key: input.objectKey,
      }),
    );
    if (!response.Body || response.ContentLength !== input.sizeBytes) {
      await response.Body?.transformToWebStream().cancel();
      throw new Error("MEDIA_SOURCE_SIZE_CHANGED");
    }
    const reader = response.Body.transformToWebStream().getReader();
    let size = 0;
    async function* chunks() {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > input.sizeBytes || size > input.maxBytes)
            throw new Error("MEDIA_SOURCE_SIZE_EXCEEDED");
          yield next.value;
        }
        if (size !== input.sizeBytes)
          throw new Error("MEDIA_SOURCE_INCOMPLETE");
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
    }
    await pipeline(
      Readable.from(chunks(), { objectMode: false, highWaterMark: 64 * 1024 }),
      createWriteStream(source, { flags: "wx" }),
    );
    return await inspectFile(source);
  } finally {
    // Verify the exact resolved generated path before recursive cleanup on Windows.
    if (
      dirname(resolve(directory)) !== resolve(tmpdir()) ||
      !basename(directory).startsWith("vcstudio-video-")
    )
      throw new Error("TEMPORARY_MEDIA_PATH_INVALID");
    await rm(directory, { recursive: true, force: true }).catch(() =>
      console.warn("Temporary video file cleanup failed."),
    );
  }
}
