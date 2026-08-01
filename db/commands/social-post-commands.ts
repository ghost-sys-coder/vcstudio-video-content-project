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
import type { SocialPostAttachmentRef } from "@/lib/social/post-attachment";

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
 * Creates a draft that already carries one of the project's finished renders.
 *
 * The entry point from a project's publish page: the author picks a render and
 * gets a normal draft, so scheduling, per-platform previews, and the capability
 * matrix all apply without a parallel code path.
 */
export async function createSocialPostForRender(input: {
  workspaceId: string;
  name: string;
  createdByUserId: string;
  projectId: string;
  renderId: string;
  bodyDocument: PortableDocument;
  bodyPlainText: string;
}): Promise<SocialPost> {
  const database = getDatabase();
  const [post] = await database
    .insert(socialPosts)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      createdByUserId: input.createdByUserId,
      projectId: input.projectId,
      bodyDocument: input.bodyDocument,
      bodyPlainText: input.bodyPlainText,
    })
    .returning();

  await database.insert(socialPostMedia).values({
    postId: post.id,
    workspaceId: input.workspaceId,
    renderId: input.renderId,
    position: 0,
  });

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
  /**
   * The attachment list in send order. Each entry names its source, because a
   * post can carry both library uploads and project renders.
   */
  attachments: SocialPostAttachmentRef[];
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
  if (input.attachments.length > 0)
    await database.insert(socialPostMedia).values(
      input.attachments.map((attachment, position) => ({
        postId: input.postId,
        workspaceId: input.workspaceId,
        mediaAssetId: attachment.source === "library" ? attachment.id : null,
        renderId: attachment.source === "render" ? attachment.id : null,
        position,
      })),
    );

  return { outcome: "updated", post: updated };
}

/**
 * Whether the body and attachments can still be changed.
 *
 * `failed` is included because nothing reached any platform — the post is
 * effectively a draft again, and a failure caused by its content (too long for
 * one destination, a rejected image) is unfixable if the post freezes on the way
 * out. `partially_failed` is deliberately excluded: some destinations already
 * carry the current text, and editing it would make the stored body disagree
 * with what is publicly live.
 */
export function isEditableStatus(status: SocialPostStatus): boolean {
  return status === "draft" || status === "scheduled" || status === "failed";
}

/**
 * Whether publishing or scheduling may be started again.
 *
 * A terminal failure has to be recoverable, otherwise a transient provider
 * outage permanently destroys the post — the author's only recourse being to
 * retype it. `partially_failed` is included and is safe: the dispatch path skips
 * any destination that already published, so a retry can only ever fill in the
 * gaps.
 */
export function isRepublishableStatus(status: SocialPostStatus): boolean {
  return (
    status === "draft" ||
    status === "scheduled" ||
    status === "failed" ||
    status === "partially_failed"
  );
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
