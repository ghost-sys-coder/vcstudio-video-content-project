import "server-only";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

export interface StoredSceneClip {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  etag: string;
  generationId: string;
  providerRequestId: string | null;
  actualCostCents: number;
  durationMilliseconds: number | null;
}

/**
 * Stores a generated clip and reads back the still it was made from.
 *
 * Clips are far larger than stills, so the size ceiling is enforced before
 * anything is written rather than after: a provider returning something
 * unexpectedly huge should be refused, not quietly billed for as storage.
 */
export async function putSceneClip(input: {
  objectKey: string;
  generationId: string;
  bytes: Uint8Array;
  contentType: string;
  providerRequestId: string | null;
  actualCostCents: number;
  durationMilliseconds: number | null;
  maximumBytes: number;
}): Promise<StoredSceneClip> {
  if (input.bytes.byteLength === 0) throw new Error("SCENE_CLIP_EMPTY");
  if (input.bytes.byteLength > input.maximumBytes)
    throw new Error("SCENE_CLIP_TOO_LARGE");

  const environment = getStorageEnvironment();
  const metadata: Record<string, string> = {
    "generation-id": input.generationId,
    "actual-cost-cents": String(input.actualCostCents),
  };
  if (input.providerRequestId)
    metadata["provider-request-id"] = input.providerRequestId;
  if (input.durationMilliseconds !== null)
    metadata["duration-ms"] = String(input.durationMilliseconds);

  const body = Buffer.from(input.bytes);
  const response = await getR2Client().send(
    new PutObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: input.contentType,
      Metadata: metadata,
    }),
  );
  if (!response.ETag) throw new Error("SCENE_CLIP_ETAG_MISSING");

  return {
    objectKey: input.objectKey,
    contentType: input.contentType,
    sizeBytes: body.byteLength,
    etag: response.ETag,
    generationId: input.generationId,
    providerRequestId: input.providerRequestId,
    actualCostCents: input.actualCostCents,
    durationMilliseconds: input.durationMilliseconds,
  };
}

/**
 * Reads an approved still so it can be sent as the clip's first frame.
 *
 * Bytes rather than a signed URL, so nothing that grants access to storage is
 * ever handed to a third-party model provider.
 */
export async function downloadSceneStillBytes(input: {
  objectKey: string;
  maximumBytes: number;
}): Promise<Uint8Array> {
  const environment = getStorageEnvironment();
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
    }),
  );
  if (!response.Body) throw new Error("SCENE_STILL_NOT_FOUND");
  if (
    response.ContentLength !== undefined &&
    response.ContentLength > input.maximumBytes
  )
    throw new Error("SCENE_STILL_TOO_LARGE");

  const bytes = await response.Body.transformToByteArray();
  if (bytes.byteLength > input.maximumBytes)
    throw new Error("SCENE_STILL_TOO_LARGE");
  return bytes;
}
