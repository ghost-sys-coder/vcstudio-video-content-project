import { describe, expect, it } from "vitest";
import { estimateRenderCostCents } from "@/lib/render/render-cost";

const RATES = { costPerMinuteCents: 30, minimumEstimateCents: 5 };

describe("estimateRenderCostCents", () => {
  it("bills whole minutes at the per-minute rate", () => {
    expect(
      estimateRenderCostCents({ durationMilliseconds: 120_000, rates: RATES }),
    ).toBe(60);
  });

  it("rounds partial minutes up so it never undercharges", () => {
    expect(
      estimateRenderCostCents({ durationMilliseconds: 61_000, rates: RATES }),
    ).toBe(60);
    expect(
      estimateRenderCostCents({ durationMilliseconds: 60_001, rates: RATES }),
    ).toBe(60);
  });

  it("applies the minimum floor for very short renders", () => {
    expect(
      estimateRenderCostCents({
        durationMilliseconds: 1_000,
        rates: { costPerMinuteCents: 1, minimumEstimateCents: 5 },
      }),
    ).toBe(5);
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      estimateRenderCostCents({ durationMilliseconds: -1, rates: RATES }),
    ).toThrow(RangeError);
    expect(() =>
      estimateRenderCostCents({
        durationMilliseconds: 1000,
        rates: { costPerMinuteCents: 0, minimumEstimateCents: 5 },
      }),
    ).toThrow(RangeError);
  });
});
