import "server-only";
import { CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/storage/r2-client";
import { getStorageEnvironment } from "@/lib/env/server";
import { requireMcp } from "./errors";

export async function mcpObjectEtag(objectKey: string) {
  const head = await getR2Client().send(
    new HeadObjectCommand({
      Bucket: getStorageEnvironment().R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
  requireMcp(
    head.ETag && head.ContentLength,
    "invalid_media",
    "An attached file is unavailable or empty.",
  );
  return head.ETag;
}

// Browser upload credentials must never retain write access to an accepted asset.
// Copy once to a server-owned key before decoding, then persist that exact key.
export async function freezeMcpUpload(objectKey: string) {
  if (objectKey.endsWith(".verified")) return objectKey;
  const Bucket = getStorageEnvironment().R2_BUCKET_NAME;
  const target = `${objectKey}.verified`;
  await getR2Client().send(
    new CopyObjectCommand({
      Bucket,
      Key: target,
      CopySource: `${Bucket}/${objectKey.split("/").map(encodeURIComponent).join("/")}`,
    }),
  );
  return target;
}
