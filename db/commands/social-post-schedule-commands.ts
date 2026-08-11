import "server-only";

import { and, eq, exists, inArray, sql } from "drizzle-orm";
import { REPUBLISHABLE_SOCIAL_POST_STATUSES } from "@/db/commands/social-post-commands";
import { getDatabase } from "@/db/drizzle";
import {
  socialPostTargets,
  socialPosts,
  type ContentPlatform,
  type SocialPost,
} from "@/db/schema";

export async function scheduleSocialPost(input: {
  workspaceId: string;
  postId: string;
  scheduledAt: Date;
  timezone: string;
  targets: {
    platform: ContentPlatform;
    connectionId: string;
    idempotencyKey: string;
    overrideBodyPlainText: string | null;
  }[];
}): Promise<SocialPost | null> {
  const database = getDatabase();
  const updateMarker = new Date();
  const updatedPost = database
    .update(socialPosts)
    .set({
      status: "scheduled",
      scheduledAt: input.scheduledAt,
      scheduledTimezone: input.timezone,
      updatedAt: updateMarker,
    })
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
        inArray(socialPosts.status, [...REPUBLISHABLE_SOCIAL_POST_STATUSES]),
      ),
    )
    .returning();

  // Every later statement is guarded by the exact timestamp written above. If
  // the post was claimed or published concurrently, the update affects no row
  // and neither its old targets nor new targets are touched. Neon HTTP's batch
  // transaction is the supported atomic primitive; callback transactions are
  // deliberately unavailable in this driver.
  const updateLanded = exists(
    database
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.id, input.postId),
          eq(socialPosts.workspaceId, input.workspaceId),
          eq(socialPosts.status, "scheduled"),
          eq(socialPosts.updatedAt, updateMarker),
        ),
      ),
  );
  const deleteReplaceableTargets = database
    .delete(socialPostTargets)
    .where(
      and(
        eq(socialPostTargets.postId, input.postId),
        eq(socialPostTargets.workspaceId, input.workspaceId),
        inArray(socialPostTargets.status, ["pending", "cancelled", "failed"]),
        updateLanded,
      ),
    );

  const statements = [updatedPost, deleteReplaceableTargets] as const;
  let updatedRows: SocialPost[];
  if (input.targets.length > 0) {
    const targetPayload = input.targets.map((target) => ({
      platform: target.platform,
      connection_id: target.connectionId,
      override_body_plain_text: target.overrideBodyPlainText,
      idempotency_key: target.idempotencyKey,
    }));
    const insertTargets = database.insert(socialPostTargets).select(
      database
        .select({
          postId: socialPosts.id,
          workspaceId: socialPosts.workspaceId,
          platform: sql<ContentPlatform>`target.platform::content_platform`.as(
            "platform",
          ),
          connectionId: sql<string>`target.connection_id::uuid`.as(
            "connection_id",
          ),
          overrideBodyPlainText: sql<
            string | null
          >`target.override_body_plain_text`.as("override_body_plain_text"),
          idempotencyKey: sql<string>`target.idempotency_key`.as(
            "idempotency_key",
          ),
        })
        .from(socialPosts)
        .innerJoin(
          sql`jsonb_to_recordset(${JSON.stringify(targetPayload)}::jsonb) as target(platform text, connection_id text, override_body_plain_text text, idempotency_key text)`,
          sql`true`,
        )
        .where(
          and(
            eq(socialPosts.id, input.postId),
            eq(socialPosts.workspaceId, input.workspaceId),
            eq(socialPosts.status, "scheduled"),
            eq(socialPosts.updatedAt, updateMarker),
          ),
        ),
    );
    const [updated] = await database.batch([...statements, insertTargets]);
    updatedRows = updated;
  } else {
    const [updated] = await database.batch([...statements]);
    updatedRows = updated;
  }
  return updatedRows[0] ?? null;
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
