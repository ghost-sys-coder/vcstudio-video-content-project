import { describe, expect, it } from "vitest";
import { estimateScriptGenerationCost } from "@/lib/costs/script-generation-cost";

const rates = {
  inputCostPerMillionCents: 15,
  outputCostPerMillionCents: 60,
};

describe("estimateScriptGenerationCost", () => {
  it("scales output tokens with the target duration", () => {
    const short = estimateScriptGenerationCost({
      prompt: "brief prompt",
      targetDurationSeconds: 30,
      ...rates,
    });
    const long = estimateScriptGenerationCost({
      prompt: "brief prompt",
      targetDurationSeconds: 600,
      ...rates,
    });
    expect(long.outputTokens).toBeGreaterThan(short.outputTokens);
  });

  it("applies a default duration when none is given", () => {
    const result = estimateScriptGenerationCost({
      prompt: "brief prompt",
      targetDurationSeconds: null,
      ...rates,
    });
    expect(result.outputTokens).toBeGreaterThanOrEqual(400);
    expect(result.estimatedCostCents).toBeGreaterThanOrEqual(1);
  });

  it("floors output tokens at the minimum for tiny durations", () => {
    const result = estimateScriptGenerationCost({
      prompt: "x",
      targetDurationSeconds: 1,
      ...rates,
    });
    expect(result.outputTokens).toBe(400);
  });

  it("returns integer, positive cost", () => {
    const result = estimateScriptGenerationCost({
      prompt: "a longer prompt ".repeat(50),
      targetDurationSeconds: 90,
      ...rates,
    });
    expect(Number.isInteger(result.estimatedCostCents)).toBe(true);
    expect(result.estimatedCostCents).toBeGreaterThan(0);
  });
});
