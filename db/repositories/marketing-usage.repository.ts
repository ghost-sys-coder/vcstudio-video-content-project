import "server-only";

import { and, desc, eq, lt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingGenerationRuns,
  marketingUsageReservations,
  type MarketingGenerationRun,
  type MarketingUsageReservation,
} from "@/db/schema";

export const MARKETING_LEDGER_PAGE_SIZE = 50;

export async function findMarketingRunByIdempotencyKey(input: {
  workspaceId: string;
  idempotencyKey: string;
}): Promise<{ run: MarketingGenerationRun; reservationId: string } | null> {
  const [row] = await getDatabase()
    .select({
      run: marketingGenerationRuns,
      reservationId: marketingUsageReservations.id,
    })
    .from(marketingGenerationRuns)
    .innerJoin(
      marketingUsageReservations,
      eq(marketingUsageReservations.runId, marketingGenerationRuns.id),
    )
    .where(
      and(
        eq(marketingGenerationRuns.workspaceId, input.workspaceId),
        eq(marketingGenerationRuns.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findMarketingRun(input: {
  workspaceId: string;
  runId: string;
}): Promise<{
  run: MarketingGenerationRun;
  reservation: MarketingUsageReservation;
} | null> {
  const [row] = await getDatabase()
    .select({
      run: marketingGenerationRuns,
      reservation: marketingUsageReservations,
    })
    .from(marketingGenerationRuns)
    .innerJoin(
      marketingUsageReservations,
      eq(marketingUsageReservations.runId, marketingGenerationRuns.id),
    )
    .where(
      and(
        eq(marketingGenerationRuns.id, input.runId),
        eq(marketingGenerationRuns.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listMarketingRuns(input: {
  workspaceId: string;
  limit?: number;
}): Promise<MarketingGenerationRun[]> {
  return getDatabase()
    .select()
    .from(marketingGenerationRuns)
    .where(eq(marketingGenerationRuns.workspaceId, input.workspaceId))
    .orderBy(desc(marketingGenerationRuns.createdAt))
    .limit(input.limit ?? MARKETING_LEDGER_PAGE_SIZE);
}

/** Spend grouped by operation, for the /app/usage marketing section. */
export async function getMarketingSpendByOperation(input: {
  workspaceId: string;
  since: Date;
}): Promise<{ operation: string; committedCents: number; runs: number }[]> {
  return getDatabase()
    .select({
      operation: marketingUsageReservations.operation,
      committedCents: sql<number>`coalesce(sum(case when ${marketingUsageReservations.status} = 'pending' then ${marketingUsageReservations.reservedCostCents} else coalesce(${marketingUsageReservations.actualCostCents}, 0) end), 0)::int`,
      runs: sql<number>`count(*)::int`,
    })
    .from(marketingUsageReservations)
    .where(
      and(
        eq(marketingUsageReservations.workspaceId, input.workspaceId),
        sql`${marketingUsageReservations.createdAt} >= ${input.since}`,
        sql`${marketingUsageReservations.status} in ('pending','reconciled')`,
      ),
    )
    .groupBy(marketingUsageReservations.operation);
}

/** Reservations past their expiry that the hourly reconciler must release. */
export async function listExpiredMarketingReservations(input: {
  now: Date;
  limit: number;
}): Promise<MarketingUsageReservation[]> {
  return getDatabase()
    .select()
    .from(marketingUsageReservations)
    .where(
      and(
        eq(marketingUsageReservations.status, "pending"),
        lt(marketingUsageReservations.expiresAt, input.now),
      ),
    )
    .limit(input.limit);
}
