import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { socialPosts, type SocialPost } from "@/db/schema";

export async function scheduleSocialPost(input: {
  workspaceId: string;
  postId: string;
  scheduledAt: Date;
  timezone: string;
}): Promise<SocialPost | null> {
  const [post] = await getDatabase()
    .update(socialPosts)
    .set({
      status: "scheduled",
      scheduledAt: input.scheduledAt,
      scheduledTimezone: input.timezone,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
        // Only a draft or an already-scheduled post can be (re)scheduled. A post
        // that is mid-publish must not be pulled back into the queue.
        inArray(socialPosts.status, ["draft", "scheduled"]),
      ),
    )
    .returning();
  return post ?? null;
}

/**
 * Returns a scheduled post to draft. Cancelling is a plain UPDATE precisely
 * because the schedule lives in PostgreSQL rather than in a delayed background
 * run — there is nothing to revoke.
 */
export async function cancelSocialPostSchedule(input: {
  workspaceId: string;
  postId: string;
}): Promise<{ cancelled: boolean }> {
  const result = await getDatabase()
    .update(socialPosts)
    .set({
      status: "draft",
      scheduledAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
        eq(socialPosts.status, "scheduled"),
      ),
    )
    .returning({ id: socialPosts.id });
  return { cancelled: result.length === 1 };
}

/**
 * Atomically claims the posts that are due.
 *
 * One statement, so two sweeps running at once cannot both claim the same post:
 * the `UPDATE` re-evaluates `status = 'scheduled'` under a row lock, and
 * `FOR UPDATE SKIP LOCKED` means a concurrent sweep steps over locked rows
 * instead of blocking behind them. `RETURNING` is what makes claiming and
 * reading the same operation — there is no window between selecting a post and
 * marking it taken.
 *
 * Deliberately not workspace-scoped: the sweep is global by design, and every
 * row it returns carries its own workspace for the dispatch that follows.
 */
export async function claimDueSocialPosts(input: {
  limit: number;
  now?: Date;
}): Promise<{ id: string; workspaceId: string }[]> {
  const now = input.now ?? new Date();
  const result = await getDatabase().execute<{
    id: string;
    workspace_id: string;
  }>(sql`
    update social_posts
    set status = 'publishing', updated_at = now()
    where id in (
      select id from social_posts
      where status = 'scheduled' and scheduled_at <= ${now}
      order by scheduled_at
      limit ${input.limit}
      for update skip locked
    )
    returning id, workspace_id
  `);
  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
  }));
}
