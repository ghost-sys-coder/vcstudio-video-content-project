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

export async function createWorkspaceLogoUploadUrl(input: {
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
      ContentLength: input.sizeBytes,
      ContentType: input.contentType,
    }),
    { expiresIn: environment.R2_SIGNED_UPLOAD_EXPIRY_SECONDS },
  );
}

export async function inspectWorkspaceLogo(objectKey: string) {
  const environment = getStorageEnvironment();
  return getR2Client().send(
    new HeadObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
}

export async function deleteWorkspaceLogoObject(objectKey: string) {
  const environment = getStorageEnvironment();
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
}

export async function createWorkspaceLogoDownloadUrl(
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
