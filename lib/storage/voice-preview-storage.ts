import "server-only";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

export interface CachedVoicePreview {
  bytes: Buffer;
  contentType: string;
}

/**
 * Reads a previously cached voice-preview clip from R2, or `null` if it has not
 * been synthesized yet. Missing objects resolve to `null`; other failures throw.
 */
export async function findCachedVoicePreview(
  objectKey: string,
): Promise<CachedVoicePreview | null> {
  const environment = getStorageEnvironment();
  try {
    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: environment.R2_BUCKET_NAME,
        Key: objectKey,
      }),
    );
    if (!response.Body) return null;
    const bytes = Buffer.from(await response.Body.transformToByteArray());
    if (bytes.byteLength === 0) return null;
    return {
      bytes,
      contentType: response.ContentType ?? "audio/mpeg",
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NoSuchKey" || error.name === "NotFound")
    )
      return null;
    throw error;
  }
}

/**
 * Stores a freshly synthesized voice-preview clip so subsequent previews of the
 * same voice replay the cached asset instead of re-synthesizing.
 */
export async function putVoicePreview(input: {
  objectKey: string;
  bytes: Buffer;
  contentType: string;
}): Promise<void> {
  const environment = getStorageEnvironment();
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
      Body: input.bytes,
      ContentLength: input.bytes.byteLength,
      ContentType: input.contentType,
    }),
  );
}
