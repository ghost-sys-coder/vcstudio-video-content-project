import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingContentItems,
  marketingGenerationRuns,
  marketingScheduleRuleRuns,
  marketingScheduleRules,
  marketingUsageReservations,
} from "@/db/schema";

export async function listMarketingScheduleRules(input: {
  workspaceId: string;
}) {
  return getDatabase()
    .select()
    .from(marketingScheduleRules)
    .where(eq(marketingScheduleRules.workspaceId, input.workspaceId))
    .orderBy(
      desc(marketingScheduleRules.isEnabled),
      marketingScheduleRules.name,
    )
    .limit(100);
}

export async function findMarketingScheduleRule(input: {
  workspaceId: string;
  ruleId: string;
}) {
  const [rule] = await getDatabase()
    .select()
    .from(marketingScheduleRules)
    .where(
      and(
        eq(marketingScheduleRules.workspaceId, input.workspaceId),
        eq(marketingScheduleRules.id, input.ruleId),
      ),
    )
    .limit(1);
  return rule ?? null;
}

export async function findMarketingScheduleRun(input: {
  workspaceId: string;
  scheduleRunId: string;
}) {
  const [row] = await getDatabase()
    .select({ run: marketingScheduleRuleRuns, rule: marketingScheduleRules })
    .from(marketingScheduleRuleRuns)
    .innerJoin(
      marketingScheduleRules,
      and(
        eq(marketingScheduleRules.id, marketingScheduleRuleRuns.ruleId),
        eq(
          marketingScheduleRules.workspaceId,
          marketingScheduleRuleRuns.workspaceId,
        ),
      ),
    )
    .where(
      and(
        eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId),
        eq(marketingScheduleRuleRuns.id, input.scheduleRunId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listMarketingScheduleRuleRuns(input: {
  workspaceId: string;
  limit?: number;
}) {
  return getDatabase()
    .select({
      run: marketingScheduleRuleRuns,
      ruleName: marketingScheduleRules.name,
    })
    .from(marketingScheduleRuleRuns)
    .innerJoin(
      marketingScheduleRules,
      and(
        eq(marketingScheduleRules.id, marketingScheduleRuleRuns.ruleId),
        eq(
          marketingScheduleRules.workspaceId,
          marketingScheduleRuleRuns.workspaceId,
        ),
      ),
    )
    .where(eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId))
    .orderBy(desc(marketingScheduleRuleRuns.scheduledFor))
    .limit(input.limit ?? 50);
}

export async function countGeneratedMarketingItemsSince(input: {
  workspaceId: string;
  since: Date;
}) {
  const [row] = await getDatabase()
    .select({ count: sql<number>`count(*)::int` })
    .from(marketingContentItems)
    .where(
      and(
        eq(marketingContentItems.workspaceId, input.workspaceId),
        gte(marketingContentItems.createdAt, input.since),
        sql`${marketingContentItems.sourceRunId} is not null`,
      ),
    );
  return row?.count ?? 0;
}

export async function getScheduleRuleCommittedSpend(input: {
  workspaceId: string;
  ruleId: string;
  since: Date;
}) {
  const [row] = await getDatabase()
    .select({
      cents: sql<number>`coalesce(sum(case when ${marketingUsageReservations.status} = 'pending' then ${marketingUsageReservations.reservedCostCents} else coalesce(${marketingUsageReservations.actualCostCents}, 0) end), 0)::int`,
    })
    .from(marketingGenerationRuns)
    .innerJoin(
      marketingUsageReservations,
      eq(marketingUsageReservations.runId, marketingGenerationRuns.id),
    )
    .where(
      and(
        eq(marketingGenerationRuns.workspaceId, input.workspaceId),
        eq(marketingGenerationRuns.subjectKind, "schedule_rule"),
        eq(marketingGenerationRuns.subjectId, input.ruleId),
        gte(marketingGenerationRuns.createdAt, input.since),
        sql`${marketingUsageReservations.status} in ('pending', 'reconciled')`,
      ),
    );
  return row?.cents ?? 0;
}
