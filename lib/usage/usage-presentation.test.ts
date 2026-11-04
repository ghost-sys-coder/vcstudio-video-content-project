import { describe, expect, it } from "vitest";
import {
  budgetProgress,
  formatBudgetDollars,
  summarizeAuditMetadata,
} from "./usage-presentation";
describe("budget display", () => {
  it("keeps zero budgets finite and explicitly without available funds", () => {
    expect(budgetProgress(0, 0)).toEqual({
      percent: 0,
      over: false,
      remainingCents: 0,
    });
    expect(budgetProgress(20, 0)).toEqual({
      percent: 100,
      over: true,
      remainingCents: 0,
    });
  });
  it("caps the displayed bar without hiding an overspend", () => {
    expect(budgetProgress(75, 100)).toEqual({
      percent: 75,
      over: false,
      remainingCents: 25,
    });
    expect(budgetProgress(125, 100)).toEqual({
      percent: 100,
      over: true,
      remainingCents: 0,
    });
  });
  it("preserves minor currency units in editable budget values", () => {
    expect(formatBudgetDollars(1725)).toBe("17.25");
    expect(formatBudgetDollars(0)).toBe("0.00");
  });
  it("preserves false and zero metadata values while keeping summaries bounded", () => {
    expect(
      summarizeAuditMetadata({
        unused: null,
        cancelled: false,
        cost: 0,
        source: "manual",
        ignored: "extra",
      }),
    ).toBe("cancelled: false · cost: 0 · source: manual");
  });
});
