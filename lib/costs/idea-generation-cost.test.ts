import { describe, expect, it } from "vitest";
import { estimateIdeaGenerationCost } from "@/lib/costs/idea-generation-cost";

const rates = {
  inputCostPerMillionCents: 100,
  outputCostPerMillionCents: 600,
};

describe("estimateIdeaGenerationCost", () => {
  it("keeps a single idea batch to a floor of one cent", () => {
    const estimate = estimateIdeaGenerationCost({
      prompt: "Short prompt.",
      count: 5,
      ...rates,
    });
    expect(estimate.estimatedCostCents).toBeGreaterThanOrEqual(1);
    expect(estimate.outputTokens).toBeGreaterThan(0);
  });

  it("scales the output-token estimate with the requested count", () => {
    const few = estimateIdeaGenerationCost({ prompt: "p", count: 3, ...rates });
    const many = estimateIdeaGenerationCost({
      prompt: "p",
      count: 8,
      ...rates,
    });
    expect(many.outputTokens).toBeGreaterThan(few.outputTokens);
  });
});
