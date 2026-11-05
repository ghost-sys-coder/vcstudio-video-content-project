import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  mediaAssets,
  socialPostMedia,
  socialPostTargets,
  socialPosts,
  videoRenders,
  type MediaAssetKind,
  type SocialPost,
  type SocialPostStatus,
  type SocialPostTarget,
} from "@/db/schema";
import {
  toLibraryAttachment,
  toRenderAttachment,
  type SocialPostAttachment,
} from "@/lib/social/post-attachment";
import type { SocialPostSummarySource } from "@/lib/social/social-post-view";

export const SOCIAL_POST_PAGE_SIZE = 50;

export async function listSocialPosts(input: {
  workspaceId: string;
  status?: SocialPostStatus;
  limit?: number;
}): Promise<SocialPostSummarySource[]> {
  const conditions = [eq(socialPosts.workspaceId, input.workspaceId)];
  if (input.status) conditions.push(eq(socialPosts.status, input.status));
  return getDatabase()
    .select({
      id: socialPosts.id,
      name: socialPosts.name,
      status: socialPosts.status,
      bodyPlainText: socialPosts.bodyPlainText,
      scheduledAt: socialPosts.scheduledAt,
      scheduledTimezone: socialPosts.scheduledTimezone,
      createdAt: socialPosts.createdAt,
    })
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
 * A post's attachments in their authored order, resolved to whichever source
 * each one came from — a library upload or a finished project render.
 *
 * Both joins are outer, because `social_post_media` guarantees exactly one of
 * the two is set (see the `social_post_media_single_source` check) rather than
 * both. Soft-deleted assets and missing render outputs are deliberately
 * included: a published post must keep showing what it sent, and the composer
 * needs to be able to say that an attachment is no longer usable.
 */
export async function listSocialPostMedia(input: {
  workspaceId: string;
  postId: string;
}): Promise<SocialPostAttachment[]> {
  const rows = await getDatabase()
    .select({
      link: { id: socialPostMedia.id, position: socialPostMedia.position },
      asset: {
        id: mediaAssets.id,
        kind: mediaAssets.kind,
        status: mediaAssets.status,
        inspectionStatus: mediaAssets.inspectionStatus,
        objectKey: mediaAssets.objectKey,
        contentType: mediaAssets.contentType,
        sizeBytes: mediaAssets.sizeBytes,
        width: mediaAssets.width,
        height: mediaAssets.height,
        durationMilliseconds: mediaAssets.durationMilliseconds,
        title: mediaAssets.title,
        altText: mediaAssets.altText,
        originalFileName: mediaAssets.originalFileName,
        createdAt: mediaAssets.createdAt,
        deletedAt: mediaAssets.deletedAt,
      },
      render: {
        id: videoRenders.id,
        status: videoRenders.status,
        assetObjectKey: videoRenders.assetObjectKey,
        assetContentType: videoRenders.assetContentType,
        assetSizeBytes: videoRenders.assetSizeBytes,
        width: videoRenders.width,
        height: videoRenders.height,
        durationMilliseconds: videoRenders.durationMilliseconds,
        outputDurationMilliseconds: videoRenders.outputDurationMilliseconds,
        createdAt: videoRenders.createdAt,
      },
    })
    .from(socialPostMedia)
    .leftJoin(
      mediaAssets,
      and(
        eq(mediaAssets.id, socialPostMedia.mediaAssetId),
        eq(mediaAssets.workspaceId, socialPostMedia.workspaceId),
      ),
    )
    .leftJoin(
      videoRenders,
      and(
        eq(videoRenders.id, socialPostMedia.renderId),
        eq(videoRenders.workspaceId, socialPostMedia.workspaceId),
      ),
    )
    .where(
      and(
        eq(socialPostMedia.postId, input.postId),
        eq(socialPostMedia.workspaceId, input.workspaceId),
      ),
    )
    .orderBy(asc(socialPostMedia.position));

  const attachments: SocialPostAttachment[] = [];
  for (const row of rows) {
    if (row.asset)
      attachments.push(
        toLibraryAttachment({
          linkId: row.link.id,
          position: row.link.position,
          asset: row.asset,
        }),
      );
    else if (row.render)
      attachments.push(
        toRenderAttachment({
          linkId: row.link.id,
          position: row.link.position,
          render: row.render,
        }),
      );
    // A row whose source resolved to neither belongs to another workspace's
    // asset or render and is dropped rather than surfaced — the join conditions
    // are the cross-workspace guard.
  }
  return attachments;
}

export type SocialPostMediaSummary = {
  mediaCount: number;
  previewObjectKey: string | null;
  previewKind: MediaAssetKind | null;
};

/** One narrow read for a bounded post list, without render snapshots or per-post queries. */
export async function listSocialPostMediaSummaries(input: {
  workspaceId: string;
  postIds: string[];
  includePreviews?: boolean;
}): Promise<Map<string, SocialPostMediaSummary>> {
  const summaries = new Map<string, SocialPostMediaSummary>();
  if (input.postIds.length === 0) return summaries;
  const rows = await getDatabase()
    .select({
      postId: socialPostMedia.postId,
      assetId: mediaAssets.id,
      assetKind: mediaAssets.kind,
      assetStatus: mediaAssets.status,
      assetInspectionStatus: mediaAssets.inspectionStatus,
      assetDeletedAt: mediaAssets.deletedAt,
      assetObjectKey: input.includePreviews
        ? mediaAssets.objectKey
        : sql<null>`null`,
      renderId: videoRenders.id,
      renderStatus: videoRenders.status,
      renderSizeBytes: videoRenders.assetSizeBytes,
      renderObjectKey: input.includePreviews
        ? videoRenders.assetObjectKey
        : sql<null>`null`,
    })
    .from(socialPostMedia)
    .leftJoin(
      mediaAssets,
      and(
        eq(mediaAssets.id, socialPostMedia.mediaAssetId),
        eq(mediaAssets.workspaceId, socialPostMedia.workspaceId),
      ),
    )
    .leftJoin(
      videoRenders,
      and(
        eq(videoRenders.id, socialPostMedia.renderId),
        eq(videoRenders.workspaceId, socialPostMedia.workspaceId),
      ),
    )
    .where(
      and(
        eq(socialPostMedia.workspaceId, input.workspaceId),
        inArray(socialPostMedia.postId, input.postIds),
      ),
    )
    .orderBy(asc(socialPostMedia.postId), asc(socialPostMedia.position));

  for (const row of rows) {
    if (!row.assetId && !row.renderId) continue;
    const summary = summaries.get(row.postId) ?? {
      mediaCount: 0,
      previewObjectKey: null,
      previewKind: null,
    };
    summary.mediaCount++;
    if (input.includePreviews && !summary.previewObjectKey) {
      if (
        row.assetId &&
        row.assetStatus === "ready" &&
        (row.assetKind !== "video" ||
          row.assetInspectionStatus === null ||
          row.assetInspectionStatus === "succeeded") &&
        row.assetDeletedAt === null &&
        row.assetObjectKey
      ) {
        summary.previewObjectKey = row.assetObjectKey;
        summary.previewKind = row.assetKind;
      } else if (
        !row.assetId &&
        row.renderStatus === "succeeded" &&
        row.renderSizeBytes !== null &&
        row.renderObjectKey
      ) {
        summary.previewObjectKey = row.renderObjectKey;
        summary.previewKind = "video";
      }
    }
    summaries.set(row.postId, summary);
  }
  return summaries;
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
