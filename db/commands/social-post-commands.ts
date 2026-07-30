import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  socialPostMedia,
  socialPosts,
  type SocialPost,
  type SocialPostStatus,
} from "@/db/schema";
import type { PortableDocument } from "@/lib/social/portable-document";

export async function createSocialPost(input: {
  workspaceId: string;
  name: string;
  createdByUserId: string;
  projectId: string | null;
}): Promise<SocialPost> {
  const [post] = await getDatabase()
    .insert(socialPosts)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      createdByUserId: input.createdByUserId,
      projectId: input.projectId,
    })
    .returning();
  return post;
}

/**
 * Saves the body and attachment list of a draft.
 *
 * Optimistically locked on `version`: two composer tabs open on the same post
 * cannot silently overwrite each other, and a stale save is reported rather than
 * applied. Guarded on the editable statuses too, so an edit can never land on a
 * post that is mid-publish or already out.
 */
export async function updateSocialPostDraft(input: {
  workspaceId: string;
  postId: string;
  expectedVersion: number;
  name: string;
  bodyDocument: PortableDocument;
  bodyPlainText: string;
  mediaAssetIds: string[];
}): Promise<
  | { outcome: "updated"; post: SocialPost }
  | { outcome: "conflict" }
  | { outcome: "not_editable" }
> {
  const database = getDatabase();

  const [post] = await database
    .select({ status: socialPosts.status, version: socialPosts.version })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!post) return { outcome: "not_editable" };
  if (!isEditableStatus(post.status)) return { outcome: "not_editable" };

  const [updated] = await database
    .update(socialPosts)
    .set({
      name: input.name,
      bodyDocument: input.bodyDocument,
      bodyPlainText: input.bodyPlainText,
      version: input.expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
        eq(socialPosts.version, input.expectedVersion),
      ),
    )
    .returning();
  if (!updated) return { outcome: "conflict" };

  // Attachments are replaced wholesale rather than diffed. The list is short and
  // fully ordered, so a replace is both simpler and immune to the position
  // collisions a partial update would have to work around.
  await database
    .delete(socialPostMedia)
    .where(
      and(
        eq(socialPostMedia.postId, input.postId),
        eq(socialPostMedia.workspaceId, input.workspaceId),
      ),
    );
  if (input.mediaAssetIds.length > 0)
    await database.insert(socialPostMedia).values(
      input.mediaAssetIds.map((mediaAssetId, position) => ({
        postId: input.postId,
        workspaceId: input.workspaceId,
        mediaAssetId,
        position,
      })),
    );

  return { outcome: "updated", post: updated };
}

export function isEditableStatus(status: SocialPostStatus): boolean {
  return status === "draft" || status === "scheduled";
}

export async function renameSocialPost(input: {
  workspaceId: string;
  postId: string;
  name: string;
}): Promise<{ updated: boolean }> {
  const result = await getDatabase()
    .update(socialPosts)
    .set({ name: input.name, updatedAt: new Date() })
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
      ),
    )
    .returning({ id: socialPosts.id });
  return { updated: result.length === 1 };
}

/**
 * Deletes a post. Only ever a draft: once a post has gone out, its targets carry
 * the external ids that are the only record of what was published.
 */
export async function deleteSocialPostDraft(input: {
  workspaceId: string;
  postId: string;
}): Promise<{ deleted: boolean }> {
  const result = await getDatabase()
    .delete(socialPosts)
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
        eq(socialPosts.status, "draft"),
      ),
    )
    .returning({ id: socialPosts.id });
  return { deleted: result.length === 1 };
}
