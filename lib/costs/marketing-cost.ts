import {
  calculateTextCostCents,
  estimateTokens,
} from "@/lib/costs/scene-analysis-cost";

export type MarketingTextRates = {
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
};

/**
 * Estimates a marketing text operation from its rendered prompt.
 *
 * Reuses `estimateTokens` and `calculateTextCostCents` rather than inventing a
 * second arithmetic: an estimate computed one way and reconciled another is how
 * a ledger quietly stops adding up. `expectedOutputTokens` is per-operation
 * because a newsletter and a chat reply differ by an order of magnitude, and the
 * estimate has to be **conservative** — a reservation that under-reserves lets
 * spend past the budget it was supposed to guard.
 */
export function estimateMarketingTextCost(input: {
  prompt: string;
  expectedOutputTokens: number;
  rates: MarketingTextRates;
}): number {
  return calculateTextCostCents({
    inputTokens: estimateTokens(input.prompt),
    outputTokens: input.expectedOutputTokens,
    inputCostPerMillionCents: input.rates.inputCostPerMillionCents,
    outputCostPerMillionCents: input.rates.outputCostPerMillionCents,
  });
}

/**
 * Expected output size per operation, in tokens.
 *
 * Deliberately generous. Reserving too little is a money bug; reserving too much
 * costs the user nothing, because the reservation reconciles down to the actual
 * figure once the provider reports real usage.
 */
export const MARKETING_EXPECTED_OUTPUT_TOKENS = {
  chat_turn: 800,
  content_draft: 700,
  ad_creative_copy: 900,
  blog_post: 2400,
  email_draft: 700,
  newsletter_draft: 1600,
  campaign_plan: 1800,
  media_story: 700,
  document_summary: 600,
  competitor_analysis: 1800,
  trend_scan: 1200,
  image_generation: 0,
} as const;

/**
 * Reconciles an estimate against real provider usage.
 *
 * Mirrors `reconcileSceneImageCost`: when the provider reported usage, that is
 * the truth; when it did not, the reserved amount stands rather than recording
 * zero for work that certainly cost something.
 */
export function reconcileMarketingCost(input: {
  reservedCostCents: number;
  actualCostCents: number | null;
}): { chargedCostCents: number; costBasis: "actual" | "reserved" } {
  if (input.actualCostCents === null)
    return {
      chargedCostCents: input.reservedCostCents,
      costBasis: "reserved",
    };
  return { chargedCostCents: input.actualCostCents, costBasis: "actual" };
}
