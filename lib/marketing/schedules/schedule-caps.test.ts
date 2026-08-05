import { describe, expect, it } from "vitest";
import { evaluateScheduleCaps } from "@/lib/marketing/schedules/schedule-caps";

describe("evaluateScheduleCaps", () => {
  it("allows totals that exactly reach both caps", () => {
    expect(
      evaluateScheduleCaps({
        itemsGeneratedToday: 9,
        requestedItems: 1,
        dailyItemCap: 10,
        ruleCommittedCents: 90,
        estimatedCostCents: 10,
        monthlyRuleBudgetCents: 100,
      }),
    ).toEqual({ allowed: true });
  });

  it("refuses a run that would exceed the daily item cap", () => {
    expect(
      evaluateScheduleCaps({
        itemsGeneratedToday: 10,
        requestedItems: 1,
        dailyItemCap: 10,
        ruleCommittedCents: 0,
        estimatedCostCents: 1,
        monthlyRuleBudgetCents: null,
      }),
    ).toEqual({ allowed: false, reason: "daily_item_cap" });
  });

  it("refuses a run that would exceed its monthly budget", () => {
    expect(
      evaluateScheduleCaps({
        itemsGeneratedToday: 0,
        requestedItems: 1,
        dailyItemCap: 10,
        ruleCommittedCents: 100,
        estimatedCostCents: 1,
        monthlyRuleBudgetCents: 100,
      }),
    ).toEqual({ allowed: false, reason: "monthly_rule_budget" });
  });
});
