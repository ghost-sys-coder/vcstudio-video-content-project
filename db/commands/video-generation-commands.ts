import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDatabase, getNeonClient } from "@/db/drizzle";
import { videoGenerations } from "@/db/schema";
import {
  buildVideoReservationSql,
  type ReserveVideoInput,
} from "./video-generation-reservation-sql";

export class VideoOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "VideoOperationError";
  }
}
export async function reserveVideoGeneration(input: ReserveVideoInput) {
  const client = getNeonClient();
  const compiled = new PgDialect().sqlToQuery(buildVideoReservationSql(input));
  const result = await client.transaction(
    [
      // A global video lock protects the dedicated credit ceiling; workspace lock
      // also serializes this with existing image/audio/render reservations.
      client`select pg_advisory_xact_lock(hashtextextended('vcstudio-video-credit',0)),pg_advisory_xact_lock(hashtextextended(${input.workspaceId},0))`,
      client.query(compiled.sql, compiled.params),
    ],
    { isolationLevel: "ReadCommitted" },
  );
  const row = z
    .array(z.object({ id: z.uuid().nullable(), result: z.string() }))
    .parse(result[1])[0];
  if (!row?.id || !["allowed", "existing"].includes(row.result))
    throw new VideoOperationError(
      row?.result ?? "reservation_failed",
      row?.result === "idempotency_conflict"
        ? "This request key was already used with different inputs."
        : `Video could not start (${row?.result ?? "reservation_failed"}). No generation was submitted.`,
    );
  return { id: row.id, created: row.result === "allowed" };
}
export async function updateVideoGeneration(input: {
  workspaceId: string;
  generationId: string;
  from: Array<typeof videoGenerations.$inferSelect.status>;
  values: Partial<typeof videoGenerations.$inferInsert>;
}) {
  const { workspaceId, generationId } = input;
  // Callers are internal commands, never a browser-supplied patch.
  const [row] = await getDatabase()
    .update(videoGenerations)
    .set({ ...input.values, updatedAt: new Date() })
    .where(
      and(
        eq(videoGenerations.id, generationId),
        eq(videoGenerations.workspaceId, workspaceId),
        inArray(videoGenerations.status, input.from),
        input.values.status === "submitting"
          ? sql`exists(select 1 from usage_reservations where workspace_id=${workspaceId}::uuid and video_generation_id=${generationId}::uuid and status='pending' and expires_at>now() and reserved_cost_cents=${videoGenerations.estimatedCostCents}) and ${videoGenerations.attemptCount}=0`
          : undefined,
      ),
    )
    .returning();
  return row ?? null;
}
/** Exactly-once settlement. Uncertain operations remain pending, never refunded. */
export async function settleVideoGeneration(input: {
  workspaceId: string;
  generationId: string;
  actualCostCents: number;
}) {
  if (!Number.isSafeInteger(input.actualCostCents) || input.actualCostCents < 0)
    throw new Error("Invalid video settlement.");
  await getDatabase().execute(sql`
    with settled as (
      update usage_reservations set status=${input.actualCostCents === 0 ? "released" : "reconciled"}::usage_reservation_status,
        actual_cost_cents=${input.actualCostCents},updated_at=now()
      where workspace_id=${input.workspaceId}::uuid and video_generation_id=${input.generationId}::uuid and status='pending' returning *
    ), updated_job as (
      update video_generations set actual_cost_cents=${input.actualCostCents},updated_at=now()
      where id=${input.generationId}::uuid and workspace_id=${input.workspaceId}::uuid and exists(select 1 from settled)
    )
    insert into usage_events(workspace_id,project_id,reservation_id,operation_type,event_type,estimated_cost_cents,actual_cost_cents,safe_metadata)
      select workspace_id,project_id,id,operation_type,${input.actualCostCents === 0 ? "released" : "reconciled"}::usage_event_type,reserved_cost_cents,${input.actualCostCents},jsonb_build_object('videoGenerationId',${input.generationId}::text) from settled
      on conflict(reservation_id,event_type) do nothing
  `);
}
