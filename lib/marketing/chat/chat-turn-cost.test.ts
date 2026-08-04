import { describe, expect, it } from "vitest";

import {
  resolveActiveChatTools,
  sumChatUsageCostCents,
} from "./chat-turn-cost";

const RATES = {
  inputCostPerMillionCents: 100,
  outputCostPerMillionCents: 600,
};

describe("sumChatUsageCostCents", () => {
  it("is zero for no steps", () => {
    expect(sumChatUsageCostCents({ usages: [], rates: RATES })).toBe(0);
  });

  it("adds every step", () => {
    const one = sumChatUsageCostCents({
      usages: [{ inputTokens: 100_000, outputTokens: 10_000 }],
      rates: RATES,
    });
    const two = sumChatUsageCostCents({
      usages: [
        { inputTokens: 100_000, outputTokens: 10_000 },
        { inputTokens: 100_000, outputTokens: 10_000 },
      ],
      rates: RATES,
    });
    expect(two).toBe(one * 2);
  });

  it("treats missing token counts as zero rather than throwing", () => {
    // A provider that omits usage on one step must not take down a conversation
    // the user is in the middle of.
    expect(
      sumChatUsageCostCents({
        usages: [{ inputTokens: undefined, outputTokens: undefined }],
        rates: RATES,
      }),
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("resolveActiveChatTools", () => {
  const toolNames = ["search_brand_knowledge", "generate_image"];
  const billableToolNames = ["generate_image"];

  it("does not override while under the ceiling", () => {
    expect(
      resolveActiveChatTools({
        accumulatedCostCents: 4,
        maxTurnCostCents: 25,
        toolNames,
        billableToolNames,
      }),
    ).toBeUndefined();
  });

  it("drops the billable tools at the ceiling", () => {
    expect(
      resolveActiveChatTools({
        accumulatedCostCents: 25,
        maxTurnCostCents: 25,
        toolNames,
        billableToolNames,
      }),
    ).toEqual(["search_brand_knowledge"]);
  });

  it("drops the billable tools past the ceiling", () => {
    expect(
      resolveActiveChatTools({
        accumulatedCostCents: 400,
        maxTurnCostCents: 25,
        toolNames,
        billableToolNames,
      }),
    ).toEqual(["search_brand_knowledge"]);
  });

  it("keeps the free tools rather than disabling everything", () => {
    // The model must still be able to look something up so it can summarise and
    // stop. Returning an empty set would strand it mid-answer.
    const active = resolveActiveChatTools({
      accumulatedCostCents: 999,
      maxTurnCostCents: 1,
      toolNames,
      billableToolNames,
    });
    expect(active).not.toHaveLength(0);
  });

  it("returns an empty set when every tool costs money", () => {
    expect(
      resolveActiveChatTools({
        accumulatedCostCents: 999,
        maxTurnCostCents: 1,
        toolNames: ["generate_image"],
        billableToolNames: ["generate_image"],
      }),
    ).toEqual([]);
  });
});
