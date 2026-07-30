import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

export class MediaAssetStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaAssetStorageError";
  }
}

export async function createMediaAssetUploadUrl(input: {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
}): Promise<string> {
  const environment = getStorageEnvironment();
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
      // Signing the exact length is what stops a browser from authorizing a
      // small upload and then streaming an arbitrarily large body.
      ContentLength: input.sizeBytes,
      ContentType: input.contentType,
    }),
    { expiresIn: environment.R2_SIGNED_UPLOAD_EXPIRY_SECONDS },
  );
}

export async function createMediaAssetDownloadUrl(
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
 * Confirms an upload actually landed and reports what is really there.
 *
 * The browser's claimed size and content type are not trusted: the stored
 * object's own metadata is what gets recorded. Images are additionally decoded
 * with `sharp` for true dimensions — mirroring `inspectCharacterReference`.
 *
 * Video is head-only. There is no ffprobe in the web runtime, so dimensions and
 * duration for video stay client-reported hints.
 */
export async function inspectMediaAsset(input: {
  objectKey: string;
  kind: "image" | "video";
}): Promise<{
  sizeBytes: number;
  contentType: string | null;
  width: number | null;
  height: number | null;
}> {
  const environment = getStorageEnvironment();
  const client = getR2Client();
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
    }),
  );
  const sizeBytes = head.ContentLength ?? 0;
  if (sizeBytes <= 0)
    throw new MediaAssetStorageError("MEDIA_ASSET_OBJECT_EMPTY");

  if (input.kind === "video")
    return {
      sizeBytes,
      contentType: head.ContentType ?? null,
      width: null,
      height: null,
    };

  const response = await client.send(
    new GetObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
    }),
  );
  if (!response.Body)
    throw new MediaAssetStorageError("MEDIA_ASSET_BODY_MISSING");
  const bytes = Buffer.from(await response.Body.transformToByteArray());
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height)
    throw new MediaAssetStorageError("MEDIA_ASSET_NOT_DECODABLE");
  return {
    sizeBytes,
    contentType: head.ContentType ?? null,
    width: metadata.width,
    height: metadata.height,
  };
}

export async function deleteMediaAssetObject(objectKey: string): Promise<void> {
  const environment = getStorageEnvironment();
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
}
