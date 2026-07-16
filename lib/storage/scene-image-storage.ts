import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  ImageGenerationProviderResult,
  ImageGenerationReference,
  ImageReferenceMimeType,
} from "@/lib/openai/image-generation-provider";
import { getStorageEnvironment } from "@/lib/env/server";
import { getR2Client } from "@/lib/storage/r2-client";

type StoredGenerationMetadata = {
  generationId: string;
  providerRequestId: string | null;
  actualCostCents: number;
  costBasis: "provider_usage" | "estimate_fallback";
  textInputUnits: number | null;
  imageInputUnits: number | null;
  outputUnits: number | null;
};

export type StoredSceneImage = StoredGenerationMetadata & {
  objectKey: string;
  contentType: ImageReferenceMimeType;
  sizeBytes: number;
  width: number;
  height: number;
  etag: string;
};

const supportedReferenceTypes = new Set<ImageReferenceMimeType>([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function parseNonnegativeInteger(
  value: string | undefined,
  field: string,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`INVALID_STORED_IMAGE_${field.toUpperCase()}`);
  return parsed;
}

function parseNullableNonnegativeInteger(
  value: string | undefined,
  field: string,
): number | null {
  return value === undefined ? null : parseNonnegativeInteger(value, field);
}

function requireSupportedContentType(
  contentType: string | undefined,
): ImageReferenceMimeType {
  if (
    !contentType ||
    !supportedReferenceTypes.has(contentType as ImageReferenceMimeType)
  )
    throw new Error("UNSUPPORTED_STORED_IMAGE_CONTENT_TYPE");
  return contentType as ImageReferenceMimeType;
}

export async function downloadSceneImageReferences(input: {
  references: Array<{
    referenceAssetIdSnapshot: string;
    objectKeySnapshot: string;
    contentTypeSnapshot: string;
    etagSnapshot: string;
  }>;
  maximumTotalBytes: number;
}): Promise<ImageGenerationReference[]> {
  const environment = getStorageEnvironment();
  const ordered = [...input.references].sort((left, right) =>
    left.referenceAssetIdSnapshot.localeCompare(right.referenceAssetIdSnapshot),
  );
  let totalBytes = 0;
  const results: ImageGenerationReference[] = [];

  for (const reference of ordered) {
    const mimeType = requireSupportedContentType(reference.contentTypeSnapshot);
    if (reference.etagSnapshot.trim().length === 0)
      throw new Error("REFERENCE_ETAG_MISSING");
    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: environment.R2_BUCKET_NAME,
        Key: reference.objectKeySnapshot,
        IfMatch: reference.etagSnapshot,
      }),
    );
    if (!response.Body) throw new Error("REFERENCE_BODY_MISSING");
    const bytes = new Uint8Array(await response.Body.transformToByteArray());
    if (response.ETag !== reference.etagSnapshot)
      throw new Error("REFERENCE_ETAG_MISMATCH");
    if (
      response.ContentLength === undefined ||
      response.ContentLength <= 0 ||
      response.ContentLength !== bytes.byteLength
    )
      throw new Error("REFERENCE_CONTENT_LENGTH_MISMATCH");
    totalBytes += bytes.byteLength;
    if (totalBytes > input.maximumTotalBytes)
      throw new Error("REFERENCE_TOTAL_SIZE_EXCEEDED");
    results.push({
      assetId: reference.referenceAssetIdSnapshot,
      bytes,
      mimeType,
    });
  }

  return results;
}

export async function putSceneImage(input: {
  objectKey: string;
  generationId: string;
  result: ImageGenerationProviderResult;
  actualCostCents: number;
  costBasis: StoredGenerationMetadata["costBasis"];
}): Promise<StoredSceneImage> {
  const environment = getStorageEnvironment();
  const usage = input.result.usage;
  const metadata: Record<string, string> = {
    "generation-id": input.generationId,
    "actual-cost-cents": String(input.actualCostCents),
    "cost-basis": input.costBasis,
    width: String(input.result.width),
    height: String(input.result.height),
  };
  if (input.result.requestId)
    metadata["provider-request-id"] = input.result.requestId;
  if (usage) {
    metadata["text-input-units"] = String(usage.inputTextTokens);
    metadata["image-input-units"] = String(usage.inputImageTokens);
    metadata["output-units"] = String(usage.outputTokens);
  }

  const response = await getR2Client().send(
    new PutObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.objectKey,
      Body: input.result.bytes,
      ContentLength: input.result.bytes.byteLength,
      ContentType: input.result.mimeType,
      Metadata: metadata,
    }),
  );
  if (!response.ETag) throw new Error("SCENE_IMAGE_ETAG_MISSING");

  return {
    objectKey: input.objectKey,
    contentType: input.result.mimeType,
    sizeBytes: input.result.bytes.byteLength,
    width: input.result.width,
    height: input.result.height,
    etag: response.ETag,
    generationId: input.generationId,
    providerRequestId: input.result.requestId,
    actualCostCents: input.actualCostCents,
    costBasis: input.costBasis,
    textInputUnits: usage?.inputTextTokens ?? null,
    imageInputUnits: usage?.inputImageTokens ?? null,
    outputUnits: usage?.outputTokens ?? null,
  };
}

export async function findStoredSceneImage(input: {
  objectKey: string;
  generationId: string;
}): Promise<StoredSceneImage | null> {
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
    throw new Error("STORED_IMAGE_GENERATION_MISMATCH");
  if (!response.ContentLength || response.ContentLength <= 0)
    throw new Error("INVALID_STORED_IMAGE_SIZE");
  if (!response.ETag) throw new Error("SCENE_IMAGE_ETAG_MISSING");
  const costBasis = metadata["cost-basis"];
  if (costBasis !== "provider_usage" && costBasis !== "estimate_fallback")
    throw new Error("INVALID_STORED_IMAGE_COST_BASIS");

  return {
    objectKey: input.objectKey,
    contentType: requireSupportedContentType(response.ContentType),
    sizeBytes: response.ContentLength,
    width: parseNonnegativeInteger(metadata.width, "width"),
    height: parseNonnegativeInteger(metadata.height, "height"),
    etag: response.ETag,
    generationId: input.generationId,
    providerRequestId: metadata["provider-request-id"] ?? null,
    actualCostCents: parseNonnegativeInteger(
      metadata["actual-cost-cents"],
      "actual_cost",
    ),
    costBasis,
    textInputUnits: parseNullableNonnegativeInteger(
      metadata["text-input-units"],
      "text_input_units",
    ),
    imageInputUnits: parseNullableNonnegativeInteger(
      metadata["image-input-units"],
      "image_input_units",
    ),
    outputUnits: parseNullableNonnegativeInteger(
      metadata["output-units"],
      "output_units",
    ),
  };
}

export async function createSceneImageDownloadUrl(
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
