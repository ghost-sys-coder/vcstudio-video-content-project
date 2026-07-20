import { describe, expect, it } from "vitest";
import { estimateTitleGenerationCost } from "@/lib/costs/title-generation-cost";

const rates = {
  inputCostPerMillionCents: 15,
  outputCostPerMillionCents: 60,
};

describe("title generation cost", () => {
  it("scales output tokens with the requested option count", () => {
    const few = estimateTitleGenerationCost({
      prompt: "brief prompt",
      optionCount: 3,
      ...rates,
    });
    const many = estimateTitleGenerationCost({
      prompt: "brief prompt",
      optionCount: 8,
      ...rates,
    });
    expect(many.outputTokens).toBeGreaterThan(few.outputTokens);
  });

  it("keeps output small — no large scene-analysis floor", () => {
    const estimate = estimateTitleGenerationCost({
      prompt: "brief prompt",
      optionCount: 5,
      ...rates,
    });
    expect(estimate.outputTokens).toBeLessThan(2000);
    expect(estimate.estimatedCostCents).toBeGreaterThanOrEqual(1);
  });

  it("tracks input tokens with prompt length", () => {
    const short = estimateTitleGenerationCost({
      prompt: "x",
      optionCount: 5,
      ...rates,
    });
    const long = estimateTitleGenerationCost({
      prompt: "x".repeat(4000),
      optionCount: 5,
      ...rates,
    });
    expect(long.inputTokens).toBeGreaterThan(short.inputTokens);
  });
});
