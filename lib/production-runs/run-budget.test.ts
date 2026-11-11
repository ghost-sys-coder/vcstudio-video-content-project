import { describe, expect, it } from "vitest";
import { decideRunBudget, formatCents } from "@/lib/production-runs/run-budget";

describe("decideRunBudget", () => {
  it("allows a step that fits and reports what remains", () => {
    expect(
      decideRunBudget({
        spentCents: 100,
        estimateCents: 50,
        maximumCents: 200,
        what: "Images",
      }),
    ).toEqual({ allowed: true, remainingCents: 50 });
  });
  it("refuses a step that would pass the ceiling and names the numbers", () => {
    const decision = decideRunBudget({
      spentCents: 180,
      estimateCents: 50,
      maximumCents: 200,
      what: "Images",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed)
      expect(decision.reason).toBe(
        "Images is estimated at $0.50, but only $0.20 of this run's $2.00 ceiling remains.",
      );
  });
  it("never reports a negative remainder", () => {
    const decision = decideRunBudget({
      spentCents: 300,
      estimateCents: 1,
      maximumCents: 200,
      what: "Audio",
    });
    if (!decision.allowed) expect(decision.reason).toContain("$0.00");
  });
  it("formats cents as dollars", () => {
    expect(formatCents(1234)).toBe("$12.34");
  });
});
