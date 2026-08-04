import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingGenerationRuns,
  marketingUsageEvents,
  marketingUsageReservations,
  type MarketingOperation,
} from "@/db/schema";

export async function attachMarketingTriggerRun(input: {
  workspaceId: string;
  runId: string;
  triggerRunId: string;
}): Promise<void> {
  await getDatabase()
    .update(marketingGenerationRuns)
    .set({
      status: "queued",
      triggerRunId: input.triggerRunId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingGenerationRuns.id, input.runId),
        eq(marketingGenerationRuns.workspaceId, input.workspaceId),
      ),
    );
}

export async function markMarketingRunRunning(input: {
  workspaceId: string;
  runId: string;
  attemptCount: number;
}): Promise<void> {
  await getDatabase()
    .update(marketingGenerationRuns)
    .set({
      status: "running",
      attemptCount: input.attemptCount,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingGenerationRuns.id, input.runId),
        eq(marketingGenerationRuns.workspaceId, input.workspaceId),
      ),
    );
}

/**
 * Settles a successful run at its actual cost.
 *
 * Run and reservation move together in one atomic batch — Neon's HTTP driver
 * has no interactive transactions, so this is the repository's established way
 * to keep two writes from diverging. The usage event is idempotent by its
 * `(reservation, type)` unique index, so a replayed reconcile cannot
 * double-count.
 */
export async function reconcileMarketingUsage(input: {
  workspaceId: string;
  runId: string;
  reservationId: string;
  operation: MarketingOperation;
  actualCostCents: number;
  inputTokens?: number;
  outputTokens?: number;
  providerRequestId?: string | null;
  safeMetadata?: Record<string, unknown>;
}): Promise<void> {
  const database = getDatabase();
  const now = new Date();

  await database.batch([
    database
      .update(marketingGenerationRuns)
      .set({
        status: "succeeded",
        actualCostCents: input.actualCostCents,
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        providerRequestId: input.providerRequestId ?? null,
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(marketingGenerationRuns.id, input.runId),
          eq(marketingGenerationRuns.workspaceId, input.workspaceId),
        ),
      ),
    database
      .update(marketingUsageReservations)
      .set({
        status: "reconciled",
        actualCostCents: input.actualCostCents,
        updatedAt: now,
      })
      .where(
        and(
          eq(marketingUsageReservations.id, input.reservationId),
          eq(marketingUsageReservations.workspaceId, input.workspaceId),
          eq(marketingUsageReservations.status, "pending"),
        ),
      ),
    database
      .insert(marketingUsageEvents)
      .values({
        workspaceId: input.workspaceId,
        reservationId: input.reservationId,
        operation: input.operation,
        eventType: "reconciled",
        actualCostCents: input.actualCostCents,
        safeMetadata: input.safeMetadata ?? {},
      })
      .onConflictDoNothing(),
  ]);
}

/**
 * Settles a failed run.
 *
 * `chargedCostCents` is the load-bearing argument. When the provider may
 * already have accepted and billed the request, the reservation is reconciled
 * at the **reserved** amount rather than released — under-recording real spend
 * is worse than over-recording it, which is the same rule
 * `trigger/thumbnail-generation.ts` already applies.
 */
export async function failMarketingRun(input: {
  workspaceId: string;
  runId: string;
  reservationId: string;
  operation: MarketingOperation;
  category: string;
  message: string;
  chargedCostCents: number;
}): Promise<void> {
  const database = getDatabase();
  const now = new Date();
  const charged = input.chargedCostCents > 0;

  await database.batch([
    database
      .update(marketingGenerationRuns)
      .set({
        status: "failed",
        actualCostCents: input.chargedCostCents,
        errorCategory: input.category,
        safeErrorMessage: input.message,
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(marketingGenerationRuns.id, input.runId),
          eq(marketingGenerationRuns.workspaceId, input.workspaceId),
        ),
      ),
    database
      .update(marketingUsageReservations)
      .set({
        status: charged ? "reconciled" : "released",
        actualCostCents: input.chargedCostCents,
        updatedAt: now,
      })
      .where(
        and(
          eq(marketingUsageReservations.id, input.reservationId),
          eq(marketingUsageReservations.workspaceId, input.workspaceId),
          eq(marketingUsageReservations.status, "pending"),
        ),
      ),
    database
      .insert(marketingUsageEvents)
      .values({
        workspaceId: input.workspaceId,
        reservationId: input.reservationId,
        operation: input.operation,
        eventType: charged ? "reconciled" : "released",
        actualCostCents: input.chargedCostCents,
        safeMetadata: { category: input.category },
      })
      .onConflictDoNothing(),
  ]);
}

/** Releases an expired pending reservation. Used by the hourly reconciler. */
export async function releaseExpiredMarketingReservation(input: {
  reservationId: string;
  now: Date;
}): Promise<boolean> {
  const released = await getDatabase()
    .update(marketingUsageReservations)
    .set({ status: "released", actualCostCents: 0, updatedAt: input.now })
    .where(
      and(
        eq(marketingUsageReservations.id, input.reservationId),
        eq(marketingUsageReservations.status, "pending"),
        sql`${marketingUsageReservations.expiresAt} < ${input.now}`,
      ),
    )
    .returning({ id: marketingUsageReservations.id });

  if (released.length === 0) return false;

  await getDatabase()
    .update(marketingGenerationRuns)
    .set({
      status: "failed",
      actualCostCents: 0,
      errorCategory: "reservation_expired",
      safeErrorMessage: "This run expired before it started.",
      completedAt: input.now,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(
          marketingGenerationRuns.id,
          sql`(select run_id from marketing_usage_reservations where id = ${input.reservationId})`,
        ),
        sql`${marketingGenerationRuns.status} in ('pending','queued','running')`,
      ),
    );

  return true;
}
