import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  socialPostTargets,
  socialPosts,
  type ContentPlatform,
  type SocialPostTarget,
} from "@/db/schema";

export async function createSocialPostTargets(input: {
  workspaceId: string;
  postId: string;
  targets: {
    platform: ContentPlatform;
    connectionId: string;
    idempotencyKey: string;
  }[];
}): Promise<SocialPostTarget[]> {
  if (input.targets.length === 0) return [];
  return getDatabase()
    .insert(socialPostTargets)
    .values(
      input.targets.map((target) => ({
        postId: input.postId,
        workspaceId: input.workspaceId,
        platform: target.platform,
        connectionId: target.connectionId,
        idempotencyKey: target.idempotencyKey,
        status: "pending" as const,
      })),
    )
    .returning();
}

/**
 * Replaces a draft's destination list. Only valid while nothing has been sent —
 * guarded by the caller, since removing a target that already published would
 * erase the only record that it exists.
 */
export async function replaceSocialPostTargets(input: {
  workspaceId: string;
  postId: string;
  targets: {
    platform: ContentPlatform;
    connectionId: string;
    idempotencyKey: string;
  }[];
}): Promise<SocialPostTarget[]> {
  const database = getDatabase();
  await database
    .delete(socialPostTargets)
    .where(
      and(
        eq(socialPostTargets.postId, input.postId),
        eq(socialPostTargets.workspaceId, input.workspaceId),
        inArray(socialPostTargets.status, ["pending", "cancelled", "failed"]),
      ),
    );
  return createSocialPostTargets(input);
}

export async function markSocialPostTargetQueued(input: {
  targetId: string;
  triggerRunId: string;
}): Promise<void> {
  await getDatabase()
    .update(socialPostTargets)
    .set({
      status: "queued",
      triggerRunId: input.triggerRunId,
      updatedAt: new Date(),
    })
    .where(eq(socialPostTargets.id, input.targetId));
}

export async function markSocialPostTargetPublishing(input: {
  targetId: string;
}): Promise<void> {
  await getDatabase()
    .update(socialPostTargets)
    .set({
      status: "publishing",
      attemptCount: sql`${socialPostTargets.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(socialPostTargets.id, input.targetId));
}

export async function recordSocialPostTargetOperation(input: {
  targetId: string;
  providerOperationId: string;
  providerOperationSecretSealed?: string | null;
}): Promise<void> {
  await getDatabase()
    .update(socialPostTargets)
    .set({
      providerOperationId: input.providerOperationId,
      ...(input.providerOperationSecretSealed !== undefined
        ? { providerOperationSecretSealed: input.providerOperationSecretSealed }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(socialPostTargets.id, input.targetId));
}

export async function markSocialPostTargetPublished(input: {
  targetId: string;
  externalPostId: string;
  externalPostUrl: string;
}): Promise<void> {
  await getDatabase()
    .update(socialPostTargets)
    .set({
      status: "published",
      externalPostId: input.externalPostId,
      externalPostUrl: input.externalPostUrl,
      publishedAt: new Date(),
      errorCategory: null,
      safeErrorMessage: null,
      // The checkpoint credential has served its purpose; keeping a decryptable
      // provider secret after success is pure risk.
      providerOperationSecretSealed: null,
      updatedAt: new Date(),
    })
    .where(eq(socialPostTargets.id, input.targetId));
}

export async function markSocialPostTargetFailed(input: {
  targetId: string;
  category: string;
  message: string;
}): Promise<void> {
  await getDatabase()
    .update(socialPostTargets)
    .set({
      status: "failed",
      errorCategory: input.category,
      safeErrorMessage: input.message,
      updatedAt: new Date(),
    })
    .where(eq(socialPostTargets.id, input.targetId));
}

/**
 * Recomputes a post's status from its targets, and returns it.
 *
 * The post status is a **projection**, never set directly by the publish task —
 * one target finishing says nothing about the post until every target has
 * settled. This is what produces `partially_failed` rather than letting the last
 * target to finish decide the whole post's outcome.
 */
export async function reconcileSocialPostStatus(input: {
  workspaceId: string;
  postId: string;
}): Promise<void> {
  const database = getDatabase();
  const targets = await database
    .select({ status: socialPostTargets.status })
    .from(socialPostTargets)
    .where(
      and(
        eq(socialPostTargets.postId, input.postId),
        eq(socialPostTargets.workspaceId, input.workspaceId),
      ),
    );
  if (targets.length === 0) return;

  const settled = targets.every(
    (target) =>
      target.status === "published" ||
      target.status === "failed" ||
      target.status === "cancelled",
  );
  if (!settled) return;

  const published = targets.filter(
    (target) => target.status === "published",
  ).length;
  const failed = targets.filter((target) => target.status === "failed").length;

  const status =
    published > 0 && failed > 0
      ? "partially_failed"
      : published > 0
        ? "published"
        : failed > 0
          ? "failed"
          : "cancelled";

  await database
    .update(socialPosts)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
      ),
    );
}

export async function markSocialPostPublishing(input: {
  workspaceId: string;
  postId: string;
}): Promise<void> {
  await getDatabase()
    .update(socialPosts)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(
      and(
        eq(socialPosts.id, input.postId),
        eq(socialPosts.workspaceId, input.workspaceId),
      ),
    );
}
