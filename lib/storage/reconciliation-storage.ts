import "server-only";

import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

const SAFE_OBJECT_KEY =
  /^(?:workspaces\/[0-9a-f-]+\/|system\/voice-previews\/)[a-zA-Z0-9._/-]+$/;

export function assertSafeReconciliationObjectKey(objectKey: string): void {
  if (
    objectKey.length > 1024 ||
    objectKey.includes("..") ||
    objectKey.startsWith("/") ||
    !SAFE_OBJECT_KEY.test(objectKey)
  )
    throw new Error("UNSAFE_RECONCILIATION_OBJECT_KEY");
}

export async function reconciliationObjectExists(
  objectKey: string,
): Promise<boolean> {
  assertSafeReconciliationObjectKey(objectKey);
  try {
    await getR2Client().send(
      new HeadObjectCommand({
        Bucket: getStorageEnvironment().R2_BUCKET_NAME,
        Key: objectKey,
      }),
    );
    return true;
  } catch (error) {
    const status =
      typeof error === "object" && error !== null
        ? Reflect.get(Reflect.get(error, "$metadata") ?? {}, "httpStatusCode")
        : undefined;
    if (status === 404) return false;
    throw error;
  }
}

export async function deleteReconciliationObject(
  objectKey: string,
): Promise<void> {
  assertSafeReconciliationObjectKey(objectKey);
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: getStorageEnvironment().R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
}
