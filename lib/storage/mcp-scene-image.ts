import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./r2-client";
import { getStorageEnvironment } from "@/lib/env/server";
export async function putMcpSceneImage(objectKey: string, bytes: Uint8Array) {
  const result = await getR2Client().send(
    new PutObjectCommand({
      Bucket: getStorageEnvironment().R2_BUCKET_NAME,
      Key: objectKey,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: "image/png",
    }),
  );
  if (!result.ETag) throw new Error("IMPORTED_IMAGE_ETAG_MISSING");
  return result.ETag;
}
