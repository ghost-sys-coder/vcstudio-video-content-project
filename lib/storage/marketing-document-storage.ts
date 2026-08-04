import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

export class MarketingDocumentStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketingDocumentStorageError";
  }
}

export async function createDocumentUploadUrl(input: {
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
      // Signing the exact length is what stops a browser authorizing a small
      // upload and then streaming an arbitrarily large body.
      ContentLength: input.sizeBytes,
      ContentType: input.contentType,
    }),
    { expiresIn: environment.R2_SIGNED_UPLOAD_EXPIRY_SECONDS },
  );
}

export async function createDocumentDownloadUrl(
  objectKey: string,
): Promise<string> {
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

/**
 * Reads back what actually landed.
 *
 * The browser's claimed byte length is a hint; the stored object's own metadata
 * is what gets recorded, and its bytes are what get extracted. `maxBytes` is
 * enforced against the **real** size before the body is fetched, so an
 * over-large object cannot be pulled into memory just to be rejected.
 */
export async function readDocumentObject(input: {
  objectKey: string;
  maxBytes: number;
}): Promise<{ bytes: Uint8Array; sizeBytes: number }> {
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
    throw new MarketingDocumentStorageError("MARKETING_DOCUMENT_EMPTY");
  if (sizeBytes > input.maxBytes)
    throw new MarketingDocumentStorageError("MARKETING_DOCUMENT_TOO_LARGE");

  const response = await client.send(
    new GetObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
    }),
  );
  if (!response.Body)
    throw new MarketingDocumentStorageError("MARKETING_DOCUMENT_BODY_MISSING");

  return {
    bytes: await response.Body.transformToByteArray(),
    sizeBytes,
  };
}

export async function deleteDocumentObject(objectKey: string): Promise<void> {
  const environment = getStorageEnvironment();
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
}
