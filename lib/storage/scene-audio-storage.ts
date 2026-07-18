import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

export interface StoredSceneAudio {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  etag: string;
  generationId: string;
  providerRequestId: string | null;
  actualCostCents: number;
  characterCount: number;
  durationMilliseconds: number | null;
}

function parseNonnegativeInteger(
  value: string | undefined,
  field: string,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`INVALID_STORED_AUDIO_${field.toUpperCase()}`);
  return parsed;
}

export async function putSceneAudio(input: {
  objectKey: string;
  generationId: string;
  bytes: Buffer;
  contentType: string;
  providerRequestId: string | null;
  actualCostCents: number;
  characterCount: number;
  durationMilliseconds: number | null;
}): Promise<StoredSceneAudio> {
  const environment = getStorageEnvironment();
  const metadata: Record<string, string> = {
    "generation-id": input.generationId,
    "actual-cost-cents": String(input.actualCostCents),
    "character-count": String(input.characterCount),
  };
  if (input.providerRequestId)
    metadata["provider-request-id"] = input.providerRequestId;
  if (input.durationMilliseconds !== null)
    metadata["duration-ms"] = String(input.durationMilliseconds);

  const response = await getR2Client().send(
    new PutObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
      Body: input.bytes,
      ContentLength: input.bytes.byteLength,
      ContentType: input.contentType,
      Metadata: metadata,
    }),
  );
  if (!response.ETag) throw new Error("SCENE_AUDIO_ETAG_MISSING");

  return {
    objectKey: input.objectKey,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
    etag: response.ETag,
    generationId: input.generationId,
    providerRequestId: input.providerRequestId,
    actualCostCents: input.actualCostCents,
    characterCount: input.characterCount,
    durationMilliseconds: input.durationMilliseconds,
  };
}

export async function findStoredSceneAudio(input: {
  objectKey: string;
  generationId: string;
}): Promise<StoredSceneAudio | null> {
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
  if (metadata["generation-id"] !== input.generationId)
    throw new Error("STORED_AUDIO_GENERATION_MISMATCH");
  if (!response.ContentLength || response.ContentLength <= 0)
    throw new Error("INVALID_STORED_AUDIO_SIZE");
  if (!response.ETag) throw new Error("SCENE_AUDIO_ETAG_MISSING");

  const durationValue = metadata["duration-ms"];
  return {
    objectKey: input.objectKey,
    contentType: response.ContentType ?? "application/octet-stream",
    sizeBytes: response.ContentLength,
    etag: response.ETag,
    generationId: input.generationId,
    providerRequestId: metadata["provider-request-id"] ?? null,
    actualCostCents: parseNonnegativeInteger(
      metadata["actual-cost-cents"],
      "actual_cost",
    ),
    characterCount: parseNonnegativeInteger(
      metadata["character-count"],
      "character_count",
    ),
    durationMilliseconds:
      durationValue === undefined
        ? null
        : parseNonnegativeInteger(durationValue, "duration_ms"),
  };
}

export async function createSceneAudioDownloadUrl(
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
