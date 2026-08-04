import { calculateTextCostCents } from "@/lib/costs/scene-analysis-cost";
import type { MarketingTextRates } from "@/lib/costs/marketing-cost";

export type ChatStepUsage = {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
};

/**
 * What a turn has cost so far, from the usage the provider has already
 * reported.
 *
 * Undefined token counts read as zero rather than throwing. A provider that
 * omits usage on one step should not take down a conversation the user is in
 * the middle of; the reservation still bounds the damage, and the reconciler
 * settles at the reserved amount when actual usage never arrives.
 */
export function sumChatUsageCostCents(input: {
  usages: readonly ChatStepUsage[];
  rates: MarketingTextRates;
}): number {
  return input.usages.reduce(
    (total, usage) =>
      total +
      calculateTextCostCents({
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        inputCostPerMillionCents: input.rates.inputCostPerMillionCents,
        outputCostPerMillionCents: input.rates.outputCostPerMillionCents,
      }),
    0,
  );
}

/**
 * Decides which tools the next step may use.
 *
 * Returning `undefined` means "no override" — every tool stays available. Once
 * the turn has spent past its ceiling, only the free tools survive, so the
 * model can still look something up but can no longer start work that costs
 * money. It must summarise what it has and stop.
 *
 * Dropping tools rather than aborting the stream is the deliberate part. An
 * abort mid-answer loses everything the turn has already paid for and shows the
 * user a broken message; a model with nothing expensive left to call writes its
 * conclusion and finishes normally.
 *
 * Note that this bounds a turn, not a conversation. Ten turns each stopping
 * one cent under the ceiling still cost ten ceilings — the workspace budget in
 * `reserveMarketingUsage` is what bounds that, and it is checked before any of
 * this runs.
 */
export function resolveActiveChatTools(input: {
  accumulatedCostCents: number;
  maxTurnCostCents: number;
  toolNames: readonly string[];
  billableToolNames: readonly string[];
}): string[] | undefined {
  if (input.accumulatedCostCents < input.maxTurnCostCents) return undefined;
  return input.toolNames.filter(
    (name) => !input.billableToolNames.includes(name),
  );
}
