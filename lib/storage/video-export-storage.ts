import "server-only";

import { readFile } from "node:fs/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

export interface StoredVideoExport {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  etag: string;
  renderId: string;
}

const VIDEO_CONTENT_TYPE = "video/mp4";

/**
 * Uploads a rendered MP4 from the worker's local output path to R2 under a
 * private, workspace-scoped key. The file is read into memory because renders
 * in this release are short; larger outputs should switch to a streamed body.
 */
export async function putVideoExportFromFile(input: {
  objectKey: string;
  filePath: string;
  renderId: string;
}): Promise<StoredVideoExport> {
  const environment = getStorageEnvironment();
  const body = await readFile(input.filePath);

  const response = await getR2Client().send(
    new PutObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: VIDEO_CONTENT_TYPE,
      Metadata: { "render-id": input.renderId },
    }),
  );
  if (!response.ETag) throw new Error("VIDEO_EXPORT_ETAG_MISSING");

  return {
    objectKey: input.objectKey,
    contentType: VIDEO_CONTENT_TYPE,
    sizeBytes: body.byteLength,
    etag: response.ETag,
    renderId: input.renderId,
  };
}

/**
 * Recovers a previously uploaded export from a crashed attempt so the render is
 * not billed or produced twice.
 */
export async function findStoredVideoExport(input: {
  objectKey: string;
  renderId: string;
}): Promise<StoredVideoExport | null> {
  const environment = getStorageEnvironment();
  let response: HeadObjectCommandOutput;
  try {
    response = await getR2Client().send(
      new HeadObjectCommand({
        Bucket: environment.R2_BUCKET_NAME,
        Key: input.objectKey,
      }),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NotFound" || error.name === "NoSuchKey")
    )
      return null;
    throw error;
  }

  const metadata = response.Metadata ?? {};
  if (metadata["render-id"] !== input.renderId)
    throw new Error("STORED_VIDEO_EXPORT_RENDER_MISMATCH");
  if (!response.ContentLength || response.ContentLength <= 0)
    throw new Error("INVALID_STORED_VIDEO_EXPORT_SIZE");
  if (!response.ETag) throw new Error("VIDEO_EXPORT_ETAG_MISSING");

  return {
    objectKey: input.objectKey,
    contentType: response.ContentType ?? VIDEO_CONTENT_TYPE,
    sizeBytes: response.ContentLength,
    etag: response.ETag,
    renderId: input.renderId,
  };
}

/**
 * `expiresInSeconds` overrides the short default download lifetime. The publish
 * worker passes a lifetime longer than its own wall clock, because a URL that
 * expires while bytes are still streaming fails the upload mid-flight — the same
 * failure mode that previously stalled long renders.
 */
export async function createVideoExportDownloadUrl(
  objectKey: string,
  expiresInSeconds?: number,
): Promise<string> {
  const environment = getStorageEnvironment();
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: objectKey,
    }),
    {
      expiresIn:
        expiresInSeconds ?? environment.R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS,
    },
  );
}

/**
 * Signs download URLs for the scene assets a consumer must fetch. Keys are
 * grouped by asset so the composition-input builder can resolve each scene's
 * image and audio independently.
 *
 * `expiresInSeconds` overrides the default download lifetime. The render worker
 * and export download keep the short default, but the in-browser preview passes
 * a long lifetime so a multi-minute session never fetches an expired URL.
 */
export async function createRenderAssetDownloadUrls(
  objectKeys: readonly string[],
  expiresInSeconds?: number,
): Promise<Record<string, string>> {
  const environment = getStorageEnvironment();
  const client = getR2Client();
  const expiresIn =
    expiresInSeconds ?? environment.R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS;
  const unique = [...new Set(objectKeys)];
  const entries = await Promise.all(
    unique.map(async (objectKey) => {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: environment.R2_BUCKET_NAME,
          Key: objectKey,
        }),
        { expiresIn },
      );
      return [objectKey, url] as const;
    }),
  );
  return Object.fromEntries(entries);
}
