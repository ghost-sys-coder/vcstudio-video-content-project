import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  mediaAssets,
  socialPostMedia,
  socialPostTargets,
  socialPosts,
  type MediaAsset,
  type SocialPost,
  type SocialPostMedia,
  type SocialPostStatus,
  type SocialPostTarget,
} from "@/db/schema";

export const SOCIAL_POST_PAGE_SIZE = 50;

export async function listSocialPosts(input: {
  workspaceId: string;
  status?: SocialPostStatus;
  limit?: number;
}): Promise<SocialPost[]> {
  const conditions = [eq(socialPosts.workspaceId, input.workspaceId)];
  if (input.status) conditions.push(eq(socialPosts.status, input.status));
  return getDatabase()
    .select()
    .from(socialPosts)
    .where(and(...conditions))
    .orderBy(desc(socialPosts.createdAt))
    .limit(
      Math.min(input.limit ?? SOCIAL_POST_PAGE_SIZE, SOCIAL_POST_PAGE_SIZE),
    );
}

/**
 * Fetch one post scoped to the authorized workspace. Returning null for a
 * foreign id is the cross-workspace guard — never look a post up by id alone.
 */
export async function findSocialPost(input: {
  workspaceId: string;
  postId: string;
}): Promise<SocialPost | null> {
  const [post] = await getDatabase()
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return post ?? null;
}

/**
 * A post's attachments in their authored order, joined to the assets themselves
 * so a caller gets both the ordering and the media in one round trip.
 *
 * Soft-deleted assets are deliberately included: a published post must keep
 * showing what it sent, and the composer needs to be able to tell the author
 * that an attachment has since been removed from the library.
 */
export async function listSocialPostMedia(input: {
  workspaceId: string;
  postId: string;
}): Promise<{ link: SocialPostMedia; asset: MediaAsset }[]> {
  const rows = await getDatabase()
    .select({ link: socialPostMedia, asset: mediaAssets })
    .from(socialPostMedia)
    .innerJoin(
      mediaAssets,
      and(
        eq(mediaAssets.id, socialPostMedia.mediaAssetId),
        eq(mediaAssets.workspaceId, socialPostMedia.workspaceId),
      ),
    )
    .where(
      and(
        eq(socialPostMedia.postId, input.postId),
        eq(socialPostMedia.workspaceId, input.workspaceId),
      ),
    )
    .orderBy(asc(socialPostMedia.position));
  return rows;
}

export async function listSocialPostTargets(input: {
  workspaceId: string;
  postId: string;
}): Promise<SocialPostTarget[]> {
  return getDatabase()
    .select()
    .from(socialPostTargets)
    .where(
      and(
        eq(socialPostTargets.postId, input.postId),
        eq(socialPostTargets.workspaceId, input.workspaceId),
      ),
    )
    .orderBy(asc(socialPostTargets.createdAt));
}

/** One target, for the publish worker. Not workspace-scoped by argument because
 * the caller supplies the workspace from its own payload and compares. */
export async function findSocialPostTargetById(
  targetId: string,
): Promise<SocialPostTarget | null> {
  const [target] = await getDatabase()
    .select()
    .from(socialPostTargets)
    .where(eq(socialPostTargets.id, targetId))
    .limit(1);
  return target ?? null;
}

/** Target rows for several posts at once, for the posts list and calendar. */
export async function listSocialPostTargetsForPosts(input: {
  workspaceId: string;
  postIds: string[];
}): Promise<SocialPostTarget[]> {
  if (input.postIds.length === 0) return [];
  return getDatabase()
    .select()
    .from(socialPostTargets)
    .where(
      and(
        eq(socialPostTargets.workspaceId, input.workspaceId),
        inArray(socialPostTargets.postId, input.postIds),
      ),
    );
}

/**
 * How many posts still reference a library asset. Used before a soft delete so
 * the confirmation can say what it will affect rather than guessing.
 */
export async function countPostsUsingMediaAsset(input: {
  workspaceId: string;
  mediaAssetId: string;
}): Promise<number> {
  const [row] = await getDatabase()
    .select({
      total: sql<number>`count(distinct ${socialPostMedia.postId})::int`,
    })
    .from(socialPostMedia)
    .where(
      and(
        eq(socialPostMedia.workspaceId, input.workspaceId),
        eq(socialPostMedia.mediaAssetId, input.mediaAssetId),
      ),
    );
  return row?.total ?? 0;
}
