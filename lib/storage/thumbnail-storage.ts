import "server-only";

import type { ImageGenerationProviderResult } from "@/lib/openai/image-generation-provider";
import {
  createSceneImageDownloadUrl,
  findStoredSceneImage,
  putSceneImage,
  type StoredSceneImage,
} from "@/lib/storage/scene-image-storage";

export type StoredThumbnail = StoredSceneImage;

/**
 * Thumbnails are stored exactly like scene images — same bucket, same metadata
 * envelope, same ETag/size validation — so these delegate rather than duplicate.
 * Only the object key differs (see `createThumbnailObjectKey`).
 */
export async function putThumbnail(input: {
  objectKey: string;
  thumbnailGenerationId: string;
  result: ImageGenerationProviderResult;
  actualCostCents: number;
  costBasis: StoredThumbnail["costBasis"];
}): Promise<StoredThumbnail> {
  return putSceneImage({
    objectKey: input.objectKey,
    generationId: input.thumbnailGenerationId,
    result: input.result,
    actualCostCents: input.actualCostCents,
    costBasis: input.costBasis,
  });
}

export async function findStoredThumbnail(input: {
  objectKey: string;
  thumbnailGenerationId: string;
}): Promise<StoredThumbnail | null> {
  return findStoredSceneImage({
    objectKey: input.objectKey,
    generationId: input.thumbnailGenerationId,
  });
}

export async function createThumbnailDownloadUrl(
  objectKey: string,
): Promise<string> {
  return createSceneImageDownloadUrl(objectKey);
}
