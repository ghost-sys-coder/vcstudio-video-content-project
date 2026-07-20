import "server-only";

import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { usageReservations, videoRenders } from "@/db/schema";

const MAX_LIST_LIMIT = 100;

/**
 * Counts how many prior renders of a specific timeline (identified by its
 * request fingerprint) have already reached a terminal failed/cancelled state.
 * Used to advance the render idempotency key so a retry of an identical
 * timeline is not silently deduplicated against a dead render, while in-flight
 * and succeeded renders (excluded here) still dedupe normally.
 */
export async function countTerminalVideoRendersForTimeline(input: {
  workspaceId: string;
  projectId: string;
  requestFingerprint: string;
}): Promise<number> {
  const [row] = await getDatabase()
    .select({ count: sql<number>`count(*)::int` })
    .from(videoRenders)
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
        eq(videoRenders.requestFingerprint, input.requestFingerprint),
        inArray(videoRenders.status, ["failed", "cancelled"]),
      ),
    );
  return row?.count ?? 0;
}

export async function findVideoRender(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
}) {
  const [render] = await getDatabase()
    .select()
    .from(videoRenders)
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
        eq(videoRenders.id, input.renderId),
      ),
    )
    .limit(1);
  return render ?? null;
}

export async function findVideoRenderByRequestNonce(input: {
  workspaceId: string;
  projectId: string;
  requestNonce: string;
}) {
  const [render] = await getDatabase()
    .select()
    .from(videoRenders)
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
        eq(videoRenders.requestNonce, input.requestNonce),
      ),
    )
    .limit(1);
  return render ?? null;
}

export async function findVideoRenderByIdempotencyKey(input: {
  workspaceId: string;
  projectId: string;
  idempotencyKey: string;
}) {
  const [render] = await getDatabase()
    .select()
    .from(videoRenders)
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
        eq(videoRenders.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return render ?? null;
}

export async function findVideoRenderReservation(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
}) {
  const [reservation] = await getDatabase()
    .select()
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.projectId, input.projectId),
        eq(usageReservations.operationType, "video_render"),
        eq(usageReservations.videoRenderId, input.renderId),
      ),
    )
    .limit(1);
  return reservation ?? null;
}

export async function findVideoRenderWorkflowContext(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
}) {
  const render = await findVideoRender(input);
  if (!render) return null;
  const reservation = await findVideoRenderReservation(input);
  return { render, reservation };
}

export async function listVideoRenders(input: {
  workspaceId: string;
  projectId: string;
  limit?: number;
}) {
  return getDatabase()
    .select()
    .from(videoRenders)
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
      ),
    )
    .orderBy(desc(videoRenders.createdAt))
    .limit(Math.min(input.limit ?? 50, MAX_LIST_LIMIT));
}

export async function listExpiredActiveVideoRenders(input: {
  now: Date;
  limit?: number;
}) {
  return getDatabase()
    .select({
      workspaceId: videoRenders.workspaceId,
      projectId: videoRenders.projectId,
      renderId: videoRenders.id,
      expiresAt: usageReservations.expiresAt,
    })
    .from(videoRenders)
    .innerJoin(
      usageReservations,
      and(
        eq(usageReservations.workspaceId, videoRenders.workspaceId),
        eq(usageReservations.projectId, videoRenders.projectId),
        eq(usageReservations.operationType, "video_render"),
        eq(usageReservations.videoRenderId, videoRenders.id),
      ),
    )
    .where(
      and(
        inArray(videoRenders.status, ["pending", "queued", "running"]),
        eq(usageReservations.status, "pending"),
        lte(usageReservations.expiresAt, input.now),
      ),
    )
    .orderBy(asc(usageReservations.expiresAt), asc(videoRenders.createdAt))
    .limit(Math.min(input.limit ?? 100, MAX_LIST_LIMIT));
}
