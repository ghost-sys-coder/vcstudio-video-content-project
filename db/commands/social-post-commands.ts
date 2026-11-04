import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  socialPostMedia,
  socialPosts,
  marketingContentItems,
  type SocialPost,
  type SocialPostStatus,
} from "@/db/schema";
import type { PortableDocument } from "@/lib/social/portable-document";
import type { SocialPostAttachmentRef } from "@/lib/social/post-attachment";
import { randomUUID } from "node:crypto";

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

export async function createSocialPostForContentItem(input: {
  workspaceId: string;
  contentItemId: string;
  name: string;
  createdByUserId: string;
  bodyDocument: PortableDocument;
  bodyPlainText: string;
  mediaAssetIds: string[];
}): Promise<SocialPost> {
  const database = getDatabase();
  const id = randomUUID();
  const postValues = {
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    createdByUserId: input.createdByUserId,
    projectId: null,
    bodyDocument: input.bodyDocument,
    bodyPlainText: input.bodyPlainText,
  };
  const insertPost = database.execute(sql`
    insert into ${socialPosts} (
      id, workspace_id, name, created_by_user_id, project_id,
      body_document, body_plain_text
    )
    select
      ${id}, ${input.workspaceId}, ${input.name}, ${input.createdByUserId}, null,
      ${JSON.stringify(input.bodyDocument)}::jsonb, ${input.bodyPlainText}
    from ${marketingContentItems}
    where ${marketingContentItems.id} = ${input.contentItemId}
      and ${marketingContentItems.workspaceId} = ${input.workspaceId}
      and ${marketingContentItems.status} = 'approved'
      and ${marketingContentItems.socialPostId} is null
  `);
  const attachPost = database
    .update(marketingContentItems)
    .set({ socialPostId: id, updatedAt: new Date() })
    .where(
      and(
        eq(marketingContentItems.id, input.contentItemId),
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.status, "approved"),
        sql`${marketingContentItems.socialPostId} is null`,
      ),
    )
    .returning({ id: marketingContentItems.id });
  let attached: { id: string }[];
  if (input.mediaAssetIds.length > 0) {
    const [, , linkedItems] = await database.batch([
      insertPost,
      database.insert(socialPostMedia).values(
        input.mediaAssetIds.map((mediaAssetId, position) => ({
          postId: id,
          workspaceId: input.workspaceId,
          mediaAssetId,
          position,
        })),
      ),
      attachPost,
    ]);
    attached = linkedItems;
  } else {
    const [, linkedItems] = await database.batch([insertPost, attachPost]);
    attached = linkedItems;
  }
  if (attached.length !== 1)
    throw new Error("Marketing content is no longer eligible for handoff.");
  return {
    ...postValues,
    status: "draft",
    scheduledAt: null,
    scheduledTimezone: "UTC",
    version: 1,
    mcpOperationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
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
  connectionIds?: string[];
}): Promise<
  | { outcome: "updated"; post: SocialPost }
  | { outcome: "conflict" }
  | { outcome: "not_editable" }
> {
  const database = getDatabase();

  // Body, revision and attachments commit together. This also makes the row's
  // MCP approval lock cover the entire draft rather than only its text.
  const result = await database.execute<{ id: string }>(sql`
    with claimed as (
      update social_posts set name = ${input.name},
        body_document = ${JSON.stringify(input.bodyDocument)}::jsonb,
        body_plain_text = ${input.bodyPlainText}, version = version + 1, updated_at = now()
      where id = ${input.postId}::uuid and workspace_id = ${input.workspaceId}::uuid
        and version = ${input.expectedVersion} and status in ('draft','scheduled','failed')
        and mcp_operation_id is null returning id
    ), removed as (
      delete from social_post_media using claimed
      where social_post_media.post_id = claimed.id
        and social_post_media.workspace_id = ${input.workspaceId}::uuid returning social_post_media.id
    ), inserted as (
      insert into social_post_media (post_id, workspace_id, media_asset_id, render_id, position)
      select claimed.id, ${input.workspaceId}::uuid,
        case when a.source = 'library' then a.id::uuid end,
        case when a.source = 'render' then a.id::uuid end, a.position
      from claimed cross join jsonb_to_recordset(${JSON.stringify(input.attachments.map((a, position) => ({ ...a, position })))}::jsonb) as a(source text, id text, position integer)
      cross join (select count(*) from removed) removal_barrier returning id
    ), removed_destinations as (
      delete from social_post_draft_destinations using claimed
      where social_post_draft_destinations.post_id = claimed.id
        and social_post_draft_destinations.workspace_id = ${input.workspaceId}::uuid
        and ${input.connectionIds !== undefined}
      returning social_post_draft_destinations.connection_id
    ), inserted_destinations as (
      insert into social_post_draft_destinations (post_id, workspace_id, connection_id)
      select claimed.id, ${input.workspaceId}::uuid, destination.id::uuid
      from claimed cross join jsonb_array_elements_text(${JSON.stringify(input.connectionIds ?? [])}::jsonb) destination(id)
      cross join (select count(*) from removed_destinations) destination_barrier
      returning connection_id
    ) select id from claimed
  `);
  if (!result.rows[0]) return { outcome: "conflict" };
  const [updated] = await database
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!updated) return { outcome: "not_editable" };
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
  return REPUBLISHABLE_SOCIAL_POST_STATUSES.includes(status);
}

export const REPUBLISHABLE_SOCIAL_POST_STATUSES: readonly SocialPostStatus[] = [
  "draft",
  "scheduled",
  "failed",
  "partially_failed",
];

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
