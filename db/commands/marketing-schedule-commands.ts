import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingScheduleRuleRuns, marketingScheduleRules } from "@/db/schema";
import { parseDateValue } from "@/lib/format/date";
import { getNextScheduleOccurrence } from "@/lib/marketing/schedules/recurrence";
import type { MarketingScheduleRuleInput } from "@/lib/schemas/marketing-schedule";

function nextClaimAt(input: {
  rule: Pick<
    MarketingScheduleRuleInput,
    | "frequency"
    | "byWeekday"
    | "byMonthDay"
    | "timeOfDayMinutes"
    | "timezone"
    | "leadTimeMinutes"
  >;
  after: Date;
}) {
  const occurrence = getNextScheduleOccurrence({
    after: new Date(
      input.after.getTime() + input.rule.leadTimeMinutes * 60_000,
    ),
    recurrence: input.rule,
  });
  return new Date(occurrence.getTime() - input.rule.leadTimeMinutes * 60_000);
}

export async function saveMarketingScheduleRule(input: {
  workspaceId: string;
  createdByUserId: string;
  rule: MarketingScheduleRuleInput;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const nextRunAt = nextClaimAt({ rule: input.rule, after: now });
  const values = {
    name: input.rule.name,
    campaignId: input.rule.campaignId,
    skillKey: input.rule.skillKey,
    contentKind: input.rule.contentKind,
    platforms: input.rule.platforms,
    trafficType: input.rule.trafficType,
    isBranded: input.rule.isBranded,
    promptBrief: input.rule.promptBrief,
    frequency: input.rule.frequency,
    byWeekday: input.rule.byWeekday,
    byMonthDay: input.rule.byMonthDay,
    timeOfDayMinutes: input.rule.timeOfDayMinutes,
    timezone: input.rule.timezone,
    leadTimeMinutes: input.rule.leadTimeMinutes,
    maxItemsPerRun: input.rule.maxItemsPerRun,
    // Auto-approval is Slice 14. A browser can never opt into it here.
    autoApprove: false,
    autoSchedule: input.rule.autoSchedule,
    monthlyBudgetCents: input.rule.monthlyBudgetCents,
    nextRunAt,
    isEnabled: true,
    pausedReason: null,
    consecutiveFailureCount: 0,
    updatedAt: now,
  } as const;

  if (input.rule.ruleId) {
    const [updated] = await getDatabase()
      .update(marketingScheduleRules)
      .set(values)
      .where(
        and(
          eq(marketingScheduleRules.id, input.rule.ruleId),
          eq(marketingScheduleRules.workspaceId, input.workspaceId),
        ),
      )
      .returning();
    if (!updated) throw new Error("MARKETING_SCHEDULE_RULE_NOT_FOUND");
    return updated;
  }

  const [created] = await getDatabase()
    .insert(marketingScheduleRules)
    .values({
      ...values,
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
    })
    .returning();
  if (!created) throw new Error("MARKETING_SCHEDULE_RULE_NOT_CREATED");
  return created;
}

export async function setMarketingScheduleRuleEnabled(input: {
  workspaceId: string;
  ruleId: string;
  enabled: boolean;
  now?: Date;
}) {
  const database = getDatabase();
  const [rule] = await database
    .select()
    .from(marketingScheduleRules)
    .where(
      and(
        eq(marketingScheduleRules.id, input.ruleId),
        eq(marketingScheduleRules.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!rule) throw new Error("MARKETING_SCHEDULE_RULE_NOT_FOUND");
  const now = input.now ?? new Date();
  const nextRunAt = input.enabled
    ? nextClaimAt({ rule, after: now })
    : rule.nextRunAt;
  await database
    .update(marketingScheduleRules)
    .set({
      isEnabled: input.enabled,
      nextRunAt,
      pausedReason: input.enabled ? null : "Paused by an owner.",
      consecutiveFailureCount: input.enabled ? 0 : rule.consecutiveFailureCount,
      updatedAt: now,
    })
    .where(
      and(
        eq(marketingScheduleRules.id, input.ruleId),
        eq(marketingScheduleRules.workspaceId, input.workspaceId),
      ),
    );
}

export async function claimDueMarketingScheduleRuns(input: {
  now?: Date;
  limit: number;
}) {
  const now = input.now ?? new Date();
  const result = await getDatabase().execute<{
    id: string;
    workspace_id: string;
    rule_id: string;
    scheduled_for: unknown;
  }>(sql`
    with due as (
      select rules.id, rules.workspace_id, rules.next_run_at,
             rules.lead_time_minutes
      from marketing_schedule_rules rules
      inner join marketing_settings settings
        on settings.workspace_id = rules.workspace_id
      where rules.is_enabled = true
        and rules.next_run_at is not null
        and rules.next_run_at <= ${now}
        and settings.studio_enabled = true
        and settings.autonomy_level <> 'manual'
      order by rules.next_run_at
      limit ${input.limit}
      for update of rules skip locked
    )
    insert into marketing_schedule_rule_runs (
      workspace_id, rule_id, scheduled_for, status
    )
    select workspace_id, id,
           next_run_at + make_interval(mins => lead_time_minutes), 'claimed'
    from due
    on conflict (rule_id, scheduled_for) do nothing
    returning id, workspace_id, rule_id, scheduled_for
  `);
  return result.rows.map((row) => {
    const scheduledFor = parseDateValue(row.scheduled_for);
    if (!scheduledFor) throw new Error("SCHEDULE_TIME_UNAVAILABLE");
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      ruleId: row.rule_id,
      scheduledFor,
    };
  });
}

export async function advanceMarketingScheduleRule(input: {
  workspaceId: string;
  ruleId: string;
  scheduledFor: Date;
  now?: Date;
}) {
  const database = getDatabase();
  const [rule] = await database
    .select()
    .from(marketingScheduleRules)
    .where(
      and(
        eq(marketingScheduleRules.id, input.ruleId),
        eq(marketingScheduleRules.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!rule) return;
  const nextOccurrence = getNextScheduleOccurrence({
    after: input.scheduledFor,
    recurrence: rule,
  });
  const nextRunAt = new Date(
    nextOccurrence.getTime() - rule.leadTimeMinutes * 60_000,
  );
  await database
    .update(marketingScheduleRules)
    .set({
      nextRunAt,
      lastRunAt: input.now ?? new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingScheduleRules.id, input.ruleId),
        eq(marketingScheduleRules.workspaceId, input.workspaceId),
        sql`${marketingScheduleRules.nextRunAt} <= ${input.now ?? new Date()}`,
      ),
    );
}

export async function markMarketingScheduleRunRunning(input: {
  workspaceId: string;
  scheduleRunId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(marketingScheduleRuleRuns)
    .set({
      status: "running",
      triggerRunId: input.triggerRunId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingScheduleRuleRuns.id, input.scheduleRunId),
        eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId),
        eq(marketingScheduleRuleRuns.status, "claimed"),
      ),
    );
}

export async function completeMarketingScheduleRun(input: {
  workspaceId: string;
  scheduleRunId: string;
  ruleId: string;
  runId: string;
  contentItemIds: string[];
}) {
  const database = getDatabase();
  await database
    .update(marketingScheduleRuleRuns)
    .set({
      status: "succeeded",
      runId: input.runId,
      createdContentItemIds: input.contentItemIds,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingScheduleRuleRuns.id, input.scheduleRunId),
        eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId),
      ),
    );
  await database
    .update(marketingScheduleRules)
    .set({
      consecutiveFailureCount: 0,
      pausedReason: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingScheduleRules.id, input.ruleId),
        eq(marketingScheduleRules.workspaceId, input.workspaceId),
      ),
    );
}

export async function skipMarketingScheduleRun(input: {
  workspaceId: string;
  scheduleRunId: string;
  ruleId: string;
  reason: string;
}) {
  const database = getDatabase();
  await database
    .update(marketingScheduleRuleRuns)
    .set({ status: "skipped", skipReason: input.reason, updatedAt: new Date() })
    .where(
      and(
        eq(marketingScheduleRuleRuns.id, input.scheduleRunId),
        eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId),
      ),
    );
  await database.execute(sql`
    update marketing_schedule_rules
    set consecutive_failure_count = consecutive_failure_count + 1,
        is_enabled = case when consecutive_failure_count + 1 >= 3 then false else is_enabled end,
        paused_reason = case when consecutive_failure_count + 1 >= 3
          then ${`Auto-paused after three consecutive skips: ${input.reason}`}
          else paused_reason end,
        updated_at = now()
    where id = ${input.ruleId} and workspace_id = ${input.workspaceId}
  `);
}

export async function failMarketingScheduleRun(input: {
  workspaceId: string;
  scheduleRunId: string;
  ruleId: string;
  category: string;
  message: string;
  runId?: string;
}) {
  const database = getDatabase();
  await database
    .update(marketingScheduleRuleRuns)
    .set({
      status: "failed",
      runId: input.runId,
      errorCategory: input.category,
      safeErrorMessage: input.message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingScheduleRuleRuns.id, input.scheduleRunId),
        eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId),
      ),
    );
  await database
    .update(marketingScheduleRules)
    .set({
      consecutiveFailureCount: sql`${marketingScheduleRules.consecutiveFailureCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingScheduleRules.id, input.ruleId),
        eq(marketingScheduleRules.workspaceId, input.workspaceId),
      ),
    );
}
