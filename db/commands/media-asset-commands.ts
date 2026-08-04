import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets, type MediaAsset, type MediaAssetKind } from "@/db/schema";

/**
 * Reserve a library row before the browser is handed a signed upload URL.
 *
 * The row exists first so the object key can be derived from a real identifier
 * rather than a client-supplied name, and so an abandoned upload leaves a
 * `pending` row that is visibly incomplete instead of an orphaned R2 object with
 * nothing pointing at it.
 */
export async function createPendingMediaAsset(input: {
  id: string;
  workspaceId: string;
  kind: MediaAssetKind;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  originalFileName: string;
  durationMilliseconds: number | null;
  uploadedByUserId: string;
}): Promise<MediaAsset> {
  const [asset] = await getDatabase()
    .insert(mediaAssets)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      kind: input.kind,
      status: "pending",
      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      originalFileName: input.originalFileName,
      title: input.originalFileName,
      durationMilliseconds: input.durationMilliseconds,
      uploadedByUserId: input.uploadedByUserId,
    })
    .returning();
  return asset;
}

export async function createGeneratedMediaAsset(input: {
  id: string;
  workspaceId: string;
  objectKey: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  width: number;
  height: number;
  title: string;
  altText: string;
  createdByUserId: string;
}): Promise<MediaAsset> {
  const [asset] = await getDatabase()
    .insert(mediaAssets)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      kind: "image",
      status: "ready",
      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      originalFileName: "generated-social-graphic",
      title: input.title,
      altText: input.altText,
      width: input.width,
      height: input.height,
      uploadedByUserId: input.createdByUserId,
    })
    .returning();
  if (!asset) throw new Error("GENERATED_MEDIA_ASSET_NOT_CREATED");
  return asset;
}

/**
 * Promote a reserved row to `ready` using what storage actually reports.
 *
 * Guarded on `status = 'pending'` so a replayed completion cannot rewrite an
 * asset that is already live and possibly attached to a published post.
 */
export async function markMediaAssetReady(input: {
  workspaceId: string;
  mediaAssetId: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMilliseconds: number | null;
}): Promise<MediaAsset | null> {
  const [asset] = await getDatabase()
    .update(mediaAssets)
    .set({
      status: "ready",
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      durationMilliseconds: input.durationMilliseconds,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.workspaceId, input.workspaceId),
        eq(mediaAssets.status, "pending"),
      ),
    )
    .returning();
  return asset ?? null;
}

/**
 * Mark a reserved row as unusable. Called when the object never arrived or could
 * not be decoded — the row is kept rather than deleted so the failure is visible
 * in the library instead of the upload silently vanishing.
 */
export async function markMediaAssetFailed(input: {
  workspaceId: string;
  mediaAssetId: string;
}): Promise<void> {
  await getDatabase()
    .update(mediaAssets)
    .set({ status: "failed", updatedAt: new Date() })
    .where(
      and(
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.workspaceId, input.workspaceId),
        eq(mediaAssets.status, "pending"),
      ),
    );
}

export async function updateMediaAssetDetails(input: {
  workspaceId: string;
  mediaAssetId: string;
  title: string;
  altText: string;
  tags: string[];
}): Promise<MediaAsset | null> {
  const [asset] = await getDatabase()
    .update(mediaAssets)
    .set({
      title: input.title,
      altText: input.altText,
      tags: input.tags,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.workspaceId, input.workspaceId),
        isNull(mediaAssets.deletedAt),
      ),
    )
    .returning();
  return asset ?? null;
}

/**
 * Soft delete. The row and its stored object both survive, because a post that
 * already published must keep showing the media it sent; the asset simply stops
 * appearing in the library and can no longer be attached to anything new.
 */
export async function softDeleteMediaAsset(input: {
  workspaceId: string;
  mediaAssetId: string;
}): Promise<{ deleted: boolean }> {
  const result = await getDatabase()
    .update(mediaAssets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.workspaceId, input.workspaceId),
        isNull(mediaAssets.deletedAt),
      ),
    )
    .returning({ id: mediaAssets.id });
  return { deleted: result.length === 1 };
}
