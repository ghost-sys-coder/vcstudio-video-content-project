import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { projects, usageReservations } from "@/db/schema";
import { getUtcBudgetWindowStarts } from "@/lib/scenes/scene-image-budget";
import type { UsageOperationType } from "@/lib/usage/usage-ledger";

export type UsageOperationRollup = {
  operationType: UsageOperationType;
  committedCents: number;
  count: number;
};

export type UsageProjectRollup = {
  projectId: string;
  projectName: string;
  committedCents: number;
  count: number;
};

export type UsageSummary = {
  dayToDateCents: number;
  monthToDateCents: number;
  pendingReservedCents: number;
  totalReconciledCents: number;
  byOperation: UsageOperationRollup[];
  byProject: UsageProjectRollup[];
};

// Committed cost of a reservation, matching the reservation SQL: reserved while
// pending, actual once reconciled, and excluded once released.
const committedCentsSql = sql<number>`
  cast(coalesce(sum(
    case
      when ${usageReservations.status} = 'pending' then ${usageReservations.reservedCostCents}
      when ${usageReservations.status} = 'reconciled' then coalesce(${usageReservations.actualCostCents}, 0)
      else 0
    end
  ), 0) as int)
`;

export async function getWorkspaceUsageSummary(input: {
  workspaceId: string;
  now?: Date;
  projectLimit?: number;
}): Promise<UsageSummary> {
  const now = input.now ?? new Date();
  const { dailyWindowStart, monthlyWindowStart } =
    getUtcBudgetWindowStarts(now);
  const workspaceFilter = eq(usageReservations.workspaceId, input.workspaceId);

  const windowCommitted = (since: Date) => sql<number>`
    cast(coalesce(sum(
      case
        when ${usageReservations.createdAt} >= ${since.toISOString()} and ${usageReservations.status} = 'pending' then ${usageReservations.reservedCostCents}
        when ${usageReservations.createdAt} >= ${since.toISOString()} and ${usageReservations.status} = 'reconciled' then coalesce(${usageReservations.actualCostCents}, 0)
        else 0
      end
    ), 0) as int)
  `;

  const [totalsRows, operationRows, projectRows] = await Promise.all([
    getDatabase()
      .select({
        dayToDateCents: windowCommitted(dailyWindowStart),
        monthToDateCents: windowCommitted(monthlyWindowStart),
        pendingReservedCents: sql<number>`cast(coalesce(sum(${usageReservations.reservedCostCents}) filter (where ${usageReservations.status} = 'pending'), 0) as int)`,
        totalReconciledCents: sql<number>`cast(coalesce(sum(${usageReservations.actualCostCents}) filter (where ${usageReservations.status} = 'reconciled'), 0) as int)`,
      })
      .from(usageReservations)
      .where(workspaceFilter),
    getDatabase()
      .select({
        operationType: usageReservations.operationType,
        committedCents: committedCentsSql,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(usageReservations)
      .where(workspaceFilter)
      .groupBy(usageReservations.operationType),
    getDatabase()
      .select({
        projectId: usageReservations.projectId,
        projectName: projects.name,
        committedCents: committedCentsSql,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(usageReservations)
      .innerJoin(projects, eq(projects.id, usageReservations.projectId))
      .where(workspaceFilter)
      .groupBy(usageReservations.projectId, projects.name)
      .orderBy(desc(committedCentsSql))
      .limit(input.projectLimit ?? 20),
  ]);

  const totals = totalsRows[0];
  return {
    dayToDateCents: Number(totals?.dayToDateCents ?? 0),
    monthToDateCents: Number(totals?.monthToDateCents ?? 0),
    pendingReservedCents: Number(totals?.pendingReservedCents ?? 0),
    totalReconciledCents: Number(totals?.totalReconciledCents ?? 0),
    byOperation: operationRows.map((row) => ({
      operationType: row.operationType,
      committedCents: Number(row.committedCents),
      count: Number(row.count),
    })),
    byProject: projectRows.map((row) => ({
      projectId: row.projectId,
      projectName: row.projectName,
      committedCents: Number(row.committedCents),
      count: Number(row.count),
    })),
  };
}
