import "server-only";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingUsageReservations, usageReservations } from "@/db/schema";

/**
 * Committed spend for a workspace over a window, across **both** ledgers.
 *
 * This is the most important function in the Marketing Studio's cost
 * governance, and the reason it exists is worth stating plainly: the workspace
 * budget is **one budget**. The video pipeline writes to `usage_reservations`
 * and the marketing studio writes to `marketing_usage_reservations`. If each
 * path summed only its own table, each would independently observe the full
 * daily allowance and the two together would spend double it.
 *
 * "Committed" means the same thing in both ledgers: a pending reservation
 * commits its **reserved** estimate, and a settled one commits its **actual**
 * cost. Released reservations commit nothing, which is what makes a refunded
 * failure stop counting against the budget.
 */
export type CommittedSpend = {
  projectPipelineCents: number;
  marketingCents: number;
  totalCents: number;
};

const COUNTED_STATUSES = ["pending", "reconciled"] as const;

export async function getWorkspaceCommittedSpend(input: {
  workspaceId: string;
  since: Date;
}): Promise<CommittedSpend> {
  const database = getDatabase();

  const [pipeline, marketing] = await Promise.all([
    database
      .select({
        value: sql<number>`coalesce(sum(case when ${usageReservations.status} = 'pending' then ${usageReservations.reservedCostCents} else coalesce(${usageReservations.actualCostCents}, 0) end), 0)::int`,
      })
      .from(usageReservations)
      .where(
        and(
          eq(usageReservations.workspaceId, input.workspaceId),
          gte(usageReservations.createdAt, input.since),
          inArray(usageReservations.status, [...COUNTED_STATUSES]),
        ),
      ),
    database
      .select({
        value: sql<number>`coalesce(sum(case when ${marketingUsageReservations.status} = 'pending' then ${marketingUsageReservations.reservedCostCents} else coalesce(${marketingUsageReservations.actualCostCents}, 0) end), 0)::int`,
      })
      .from(marketingUsageReservations)
      .where(
        and(
          eq(marketingUsageReservations.workspaceId, input.workspaceId),
          gte(marketingUsageReservations.createdAt, input.since),
          inArray(marketingUsageReservations.status, [...COUNTED_STATUSES]),
        ),
      ),
  ]);

  const projectPipelineCents = pipeline[0]?.value ?? 0;
  const marketingCents = marketing[0]?.value ?? 0;

  return {
    projectPipelineCents,
    marketingCents,
    totalCents: projectPipelineCents + marketingCents,
  };
}

/** Marketing-only committed spend, for the marketing sub-cap. */
export async function getMarketingCommittedSpend(input: {
  workspaceId: string;
  since: Date;
}): Promise<number> {
  const [row] = await getDatabase()
    .select({
      value: sql<number>`coalesce(sum(case when ${marketingUsageReservations.status} = 'pending' then ${marketingUsageReservations.reservedCostCents} else coalesce(${marketingUsageReservations.actualCostCents}, 0) end), 0)::int`,
    })
    .from(marketingUsageReservations)
    .where(
      and(
        eq(marketingUsageReservations.workspaceId, input.workspaceId),
        gte(marketingUsageReservations.createdAt, input.since),
        inArray(marketingUsageReservations.status, [...COUNTED_STATUSES]),
      ),
    );
  return row?.value ?? 0;
}
