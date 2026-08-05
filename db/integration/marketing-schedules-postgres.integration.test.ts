import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  claimDueMarketingScheduleRuns,
  saveMarketingScheduleRule,
  skipMarketingScheduleRun,
} from "@/db/commands/marketing-schedule-commands";
import { getDatabase } from "@/db/drizzle";
import {
  marketingScheduleRuleRuns,
  marketingScheduleRules,
  marketingSettings,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;
const workspaceIds = new Set<string>();
const userIds = new Set<string>();

async function createFixture(autonomyLevel: "manual" | "assisted") {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const label = randomUUID();
  workspaceIds.add(workspaceId);
  userIds.add(userId);
  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `schedule-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Schedule Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Schedule Workspace",
      slug: `schedule-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
    database.insert(marketingSettings).values({
      workspaceId,
      updatedByUserId: userId,
      studioEnabled: true,
      autonomyLevel,
    }),
  ]);
  const rule = await saveMarketingScheduleRule({
    workspaceId,
    createdByUserId: userId,
    now: new Date("2026-08-05T00:00:00.000Z"),
    rule: {
      name: "Integration schedule",
      campaignId: null,
      skillKey: "create_social_post",
      contentKind: "social_post",
      platforms: ["linkedin"],
      trafficType: "organic",
      isBranded: true,
      promptBrief: "Create one useful local business marketing insight.",
      frequency: "daily",
      byWeekday: [],
      byMonthDay: null,
      timeOfDayMinutes: 9 * 60,
      timezone: "UTC",
      leadTimeMinutes: 60,
      maxItemsPerRun: 1,
      autoSchedule: true,
      monthlyBudgetCents: 100,
    },
  });
  return { workspaceId, userId, rule };
}

async function makeDue(ruleId: string, workspaceId: string, at: Date) {
  await getDatabase()
    .update(marketingScheduleRules)
    .set({ nextRunAt: at })
    .where(
      and(
        eq(marketingScheduleRules.id, ruleId),
        eq(marketingScheduleRules.workspaceId, workspaceId),
      ),
    );
}

async function cleanup() {
  if (workspaceIds.size)
    await getDatabase()
      .delete(workspaces)
      .where(inArray(workspaces.id, [...workspaceIds]));
  if (userIds.size)
    await getDatabase()
      .delete(users)
      .where(inArray(users.id, [...userIds]));
}

describeDatabase("marketing schedules (postgres)", () => {
  afterAll(cleanup);

  it("claims one occurrence exactly once under concurrent sweeps", async () => {
    const fixture = await createFixture("assisted");
    const now = new Date("2026-08-05T12:00:00.000Z");
    await makeDue(fixture.rule.id, fixture.workspaceId, now);
    const sweeps = await Promise.all([
      claimDueMarketingScheduleRuns({ now, limit: 25 }),
      claimDueMarketingScheduleRuns({ now, limit: 25 }),
    ]);
    const claimed = sweeps
      .flat()
      .filter((run) => run.ruleId === fixture.rule.id);
    expect(claimed).toHaveLength(1);
    const rows = await getDatabase()
      .select()
      .from(marketingScheduleRuleRuns)
      .where(eq(marketingScheduleRuleRuns.ruleId, fixture.rule.id));
    expect(rows).toHaveLength(1);
  }, 30_000);

  it("does not claim while workspace autonomy is manual", async () => {
    const fixture = await createFixture("manual");
    const now = new Date("2026-08-05T12:00:00.000Z");
    await makeDue(fixture.rule.id, fixture.workspaceId, now);
    const claimed = await claimDueMarketingScheduleRuns({ now, limit: 25 });
    expect(claimed.some((run) => run.ruleId === fixture.rule.id)).toBe(false);
  }, 30_000);

  it("auto-pauses after three consecutive cap skips", async () => {
    const fixture = await createFixture("assisted");
    for (let index = 0; index < 3; index += 1) {
      const [run] = await getDatabase()
        .insert(marketingScheduleRuleRuns)
        .values({
          workspaceId: fixture.workspaceId,
          ruleId: fixture.rule.id,
          scheduledFor: new Date(Date.UTC(2026, 7, 10 + index, 9)),
        })
        .returning();
      if (!run) throw new Error("Fixture run was not created.");
      await skipMarketingScheduleRun({
        workspaceId: fixture.workspaceId,
        scheduleRunId: run.id,
        ruleId: fixture.rule.id,
        reason: "monthly_rule_budget",
      });
    }
    const [paused] = await getDatabase()
      .select()
      .from(marketingScheduleRules)
      .where(eq(marketingScheduleRules.id, fixture.rule.id));
    expect(paused?.isEnabled).toBe(false);
    expect(paused?.consecutiveFailureCount).toBe(3);
    expect(paused?.pausedReason).toContain("three consecutive skips");
  }, 30_000);
});
