import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import {
  getCharacterEnvironment,
  getStorageEnvironment,
} from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";
import { areReferenceDimensionsAllowed } from "@/lib/domain/character";

export async function createCharacterReferenceUploadUrl(input: {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
}) {
  const environment = getStorageEnvironment();
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
      ContentLength: input.sizeBytes,
      ContentType: input.contentType,
    }),
    { expiresIn: environment.R2_SIGNED_UPLOAD_EXPIRY_SECONDS },
  );
}

export async function inspectCharacterReference(objectKey: string) {
  const storage = getStorageEnvironment();
  const limits = getCharacterEnvironment();
  const client = getR2Client();
  const head = await client.send(
    new HeadObjectCommand({ Bucket: storage.R2_BUCKET_NAME, Key: objectKey }),
  );
  const response = await client.send(
    new GetObjectCommand({ Bucket: storage.R2_BUCKET_NAME, Key: objectKey }),
  );
  if (!response.Body) throw new Error("REFERENCE_BODY_MISSING");
  const bytes = Buffer.from(await response.Body.transformToByteArray());
  const metadata = await sharp(bytes).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) throw new Error("REFERENCE_DIMENSIONS_MISSING");
  const expectedFormat =
    head.ContentType === "image/jpeg"
      ? "jpeg"
      : head.ContentType?.replace("image/", "");
  if (metadata.format !== expectedFormat)
    throw new Error("REFERENCE_FORMAT_MISMATCH");
  if (
    !areReferenceDimensionsAllowed({
      width,
      height,
      minimumWidth: limits.MIN_REFERENCE_IMAGE_WIDTH,
      minimumHeight: limits.MIN_REFERENCE_IMAGE_HEIGHT,
      maximumWidth: limits.MAX_REFERENCE_IMAGE_WIDTH,
      maximumHeight: limits.MAX_REFERENCE_IMAGE_HEIGHT,
    })
  )
    throw new Error("REFERENCE_DIMENSIONS_INVALID");
  return { head, width, height };
}

export async function deleteCharacterReferenceObject(objectKey: string) {
  const environment = getStorageEnvironment();
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
}

export async function createCharacterReferenceDownloadUrl(objectKey: string) {
  const environment = getStorageEnvironment();
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: objectKey,
    }),
    { expiresIn: environment.R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS },
  );
}
