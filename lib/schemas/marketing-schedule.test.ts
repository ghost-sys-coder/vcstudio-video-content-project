import { describe, expect, it } from "vitest";
import { marketingScheduleRuleSchema } from "@/lib/schemas/marketing-schedule";

const base = {
  name: "Weekly insight",
  campaignId: "",
  skillKey: "create_social_post" as const,
  platforms: ["linkedin" as const],
  trafficType: "organic" as const,
  isBranded: true,
  promptBrief: "Share one useful and current insight for local businesses.",
  frequency: "weekly" as const,
  byWeekday: [1],
  byMonthDay: null,
  timeOfDayMinutes: 540,
  timezone: "Africa/Kampala",
  leadTimeMinutes: 1440,
  maxItemsPerRun: 1,
  autoSchedule: true,
  monthlyBudgetCents: 500,
};

describe("marketingScheduleRuleSchema", () => {
  it("derives the content kind from the approved skill", () => {
    const result = marketingScheduleRuleSchema.parse(base);
    expect(result.contentKind).toBe("social_post");
  });

  it("rejects a weekly rule without weekdays", () => {
    expect(
      marketingScheduleRuleSchema.safeParse({ ...base, byWeekday: [] }).success,
    ).toBe(false);
  });

  it("rejects monthly day 31 so no month is silently skipped", () => {
    expect(
      marketingScheduleRuleSchema.safeParse({
        ...base,
        frequency: "monthly",
        byWeekday: [],
        byMonthDay: 31,
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid timezone", () => {
    expect(
      marketingScheduleRuleSchema.safeParse({
        ...base,
        timezone: "Somewhere/Invalid",
      }).success,
    ).toBe(false);
  });
});
