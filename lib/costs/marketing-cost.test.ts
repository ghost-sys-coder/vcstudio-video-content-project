import { describe, expect, it } from "vitest";

import {
  MARKETING_EXPECTED_OUTPUT_TOKENS,
  estimateMarketingTextCost,
  reconcileMarketingCost,
} from "@/lib/costs/marketing-cost";

const RATES = {
  inputCostPerMillionCents: 100,
  outputCostPerMillionCents: 600,
};

describe("estimateMarketingTextCost", () => {
  it("never estimates zero for real work", () => {
    // A zero estimate would reserve nothing and let the operation past every
    // budget guard it was supposed to pass through.
    expect(
      estimateMarketingTextCost({
        prompt: "hi",
        expectedOutputTokens: 1,
        rates: RATES,
      }),
    ).toBeGreaterThan(0);
  });

  it("grows with prompt length", () => {
    const small = estimateMarketingTextCost({
      prompt: "x".repeat(1000),
      expectedOutputTokens: 500,
      rates: RATES,
    });
    const large = estimateMarketingTextCost({
      prompt: "x".repeat(400_000),
      expectedOutputTokens: 500,
      rates: RATES,
    });
    expect(large).toBeGreaterThan(small);
  });

  it("grows with expected output", () => {
    const short = estimateMarketingTextCost({
      prompt: "brief",
      expectedOutputTokens: 100,
      rates: RATES,
    });
    const long = estimateMarketingTextCost({
      prompt: "brief",
      expectedOutputTokens: 5000,
      rates: RATES,
    });
    expect(long).toBeGreaterThan(short);
  });

  it("expects a blog post to cost more than a chat turn", () => {
    expect(MARKETING_EXPECTED_OUTPUT_TOKENS.blog_post).toBeGreaterThan(
      MARKETING_EXPECTED_OUTPUT_TOKENS.chat_turn,
    );
  });

  it("covers every operation with an expected output size", () => {
    for (const value of Object.values(MARKETING_EXPECTED_OUTPUT_TOKENS))
      expect(value).toBeGreaterThanOrEqual(0);
  });
});

describe("reconcileMarketingCost", () => {
  it("charges the actual cost when the provider reported usage", () => {
    expect(
      reconcileMarketingCost({ reservedCostCents: 40, actualCostCents: 12 }),
    ).toEqual({ chargedCostCents: 12, costBasis: "actual" });
  });

  it("falls back to the reserved amount when usage is unavailable", () => {
    // Recording zero for work that certainly cost something under-records real
    // spend, which is the worse of the two errors.
    expect(
      reconcileMarketingCost({ reservedCostCents: 40, actualCostCents: null }),
    ).toEqual({ chargedCostCents: 40, costBasis: "reserved" });
  });

  it("keeps a genuine zero from the provider as zero", () => {
    expect(
      reconcileMarketingCost({ reservedCostCents: 40, actualCostCents: 0 })
        .chargedCostCents,
    ).toBe(0);
  });
});
