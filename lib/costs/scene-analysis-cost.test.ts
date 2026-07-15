import { describe, expect, it } from "vitest";
import {
  calculateTextCostCents,
  estimateSceneAnalysisCost,
} from "@/lib/costs/scene-analysis-cost";

describe("scene analysis costs", () => {
  it("rounds provider costs up to cents", () =>
    expect(
      calculateTextCostCents({
        inputTokens: 1000,
        outputTokens: 1000,
        inputCostPerMillionCents: 100,
        outputCostPerMillionCents: 600,
      }),
    ).toBe(1));
  it("produces a nonzero reservation", () =>
    expect(
      estimateSceneAnalysisCost({
        prompt: "x".repeat(10000),
        inputCostPerMillionCents: 100,
        outputCostPerMillionCents: 600,
      }).estimatedCostCents,
    ).toBeGreaterThan(0));
});
