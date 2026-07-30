import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets, type MediaAsset, type MediaAssetKind } from "@/db/schema";

/** Cap on one page of the library grid, so a large workspace cannot fan out. */
export const MEDIA_ASSET_PAGE_SIZE = 60;

/**
 * List a workspace's usable library assets, newest first.
 *
 * Only `ready` rows are returned: a `pending` row is an authorized upload whose
 * object may not exist yet, and a `failed` row has no usable object at all, so
 * neither can be attached to a post. Soft-deleted rows are excluded here but
 * remain readable by id, because a published post still has to show what it sent.
 */
export async function listMediaAssets(input: {
  workspaceId: string;
  kind?: MediaAssetKind;
  limit?: number;
  offset?: number;
}): Promise<MediaAsset[]> {
  const conditions = [
    eq(mediaAssets.workspaceId, input.workspaceId),
    eq(mediaAssets.status, "ready"),
    isNull(mediaAssets.deletedAt),
  ];
  if (input.kind) conditions.push(eq(mediaAssets.kind, input.kind));
  return getDatabase()
    .select()
    .from(mediaAssets)
    .where(and(...conditions))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(
      Math.min(input.limit ?? MEDIA_ASSET_PAGE_SIZE, MEDIA_ASSET_PAGE_SIZE),
    )
    .offset(input.offset ?? 0);
}

export async function countMediaAssets(input: {
  workspaceId: string;
  kind?: MediaAssetKind;
}): Promise<number> {
  const conditions = [
    eq(mediaAssets.workspaceId, input.workspaceId),
    eq(mediaAssets.status, "ready"),
    isNull(mediaAssets.deletedAt),
  ];
  if (input.kind) conditions.push(eq(mediaAssets.kind, input.kind));
  const [row] = await getDatabase()
    .select({ total: sql<number>`count(*)::int` })
    .from(mediaAssets)
    .where(and(...conditions));
  return row?.total ?? 0;
}

/**
 * Fetch one asset scoped to the authorized workspace. Returning null for a
 * foreign id is the cross-workspace guard — never look an asset up by id alone.
 */
export async function findMediaAsset(input: {
  workspaceId: string;
  mediaAssetId: string;
}): Promise<MediaAsset | null> {
  const [asset] = await getDatabase()
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return asset ?? null;
}

/**
 * Fetch several assets at once, workspace scoped and `ready` only — the shape a
 * post composer needs when resolving its ordered attachments. Returned in
 * database order; callers that care about attachment order must re-sort by their
 * own position, not rely on this.
 */
export async function findReadyMediaAssets(input: {
  workspaceId: string;
  mediaAssetIds: string[];
}): Promise<MediaAsset[]> {
  if (input.mediaAssetIds.length === 0) return [];
  return getDatabase()
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.workspaceId, input.workspaceId),
        inArray(mediaAssets.id, input.mediaAssetIds),
        eq(mediaAssets.status, "ready"),
        isNull(mediaAssets.deletedAt),
      ),
    );
}
