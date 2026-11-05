import "server-only";
import { and, desc, eq, lt, or, inArray, isNotNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { videoGenerations, usageReservations } from "@/db/schema";
export async function listExpiredVideoReservations() {
  return getDatabase()
    .select({
      id: videoGenerations.id,
      workspaceId: videoGenerations.workspaceId,
      status: videoGenerations.status,
      attemptCount: videoGenerations.attemptCount,
      actualCostCents: videoGenerations.actualCostCents,
    })
    .from(videoGenerations)
    .innerJoin(
      usageReservations,
      and(
        eq(usageReservations.videoGenerationId, videoGenerations.id),
        eq(usageReservations.workspaceId, videoGenerations.workspaceId),
      ),
    )
    .where(
      and(
        eq(usageReservations.status, "pending"),
        lt(usageReservations.expiresAt, new Date()),
        or(
          inArray(videoGenerations.status, [
            "queued",
            "submitting",
            "running",
            "inspecting",
          ]),
          and(
            eq(videoGenerations.status, "succeeded"),
            isNotNull(videoGenerations.actualCostCents),
          ),
          and(
            inArray(videoGenerations.status, ["cancelled", "failed"]),
            eq(videoGenerations.attemptCount, 0),
          ),
        ),
      ),
    )
    .orderBy(usageReservations.expiresAt)
    .limit(25);
}

export async function findVideoGeneration(input: {
  workspaceId: string;
  generationId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(videoGenerations)
    .where(
      and(
        eq(videoGenerations.workspaceId, input.workspaceId),
        eq(videoGenerations.id, input.generationId),
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function hasPendingProjectVideoAccounting(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [row] = await getDatabase()
    .select({ id: usageReservations.id })
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.projectId, input.projectId),
        eq(usageReservations.operationType, "video_generation"),
        eq(usageReservations.status, "pending"),
      ),
    )
    .limit(1);
  return Boolean(row);
}
export async function findVideoGenerationByKey(input: {
  workspaceId: string;
  idempotencyKey: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(videoGenerations)
    .where(
      and(
        eq(videoGenerations.workspaceId, input.workspaceId),
        eq(videoGenerations.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function listVideoGenerations(input: {
  workspaceId: string;
  cursor?: { createdAt: Date; id: string };
}) {
  const cursor = input.cursor;
  return getDatabase()
    .select()
    .from(videoGenerations)
    .where(
      and(
        eq(videoGenerations.workspaceId, input.workspaceId),
        cursor
          ? or(
              lt(videoGenerations.createdAt, cursor.createdAt),
              and(
                eq(videoGenerations.createdAt, cursor.createdAt),
                lt(videoGenerations.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(videoGenerations.createdAt), desc(videoGenerations.id))
    .limit(25);
}
