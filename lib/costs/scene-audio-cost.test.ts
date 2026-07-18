import { describe, expect, it } from "vitest";
import { estimateSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";

const rates = {
  costPerMillionCharactersCents: 1500,
  minimumEstimateCents: 1,
};

describe("estimateSceneAudioCostCents", () => {
  it("scales with character count", () => {
    expect(
      estimateSceneAudioCostCents({ characterCount: 1_000_000, rates }),
    ).toBe(1500);
  });

  it("rounds partial cents up", () => {
    expect(estimateSceneAudioCostCents({ characterCount: 1, rates })).toBe(1);
    expect(estimateSceneAudioCostCents({ characterCount: 1000, rates })).toBe(
      2,
    );
  });

  it("enforces the configured minimum estimate", () => {
    expect(
      estimateSceneAudioCostCents({
        characterCount: 10,
        rates: { costPerMillionCharactersCents: 1500, minimumEstimateCents: 5 },
      }),
    ).toBe(5);
  });

  it("rejects a negative character count", () => {
    expect(() =>
      estimateSceneAudioCostCents({ characterCount: -1, rates }),
    ).toThrow();
  });
});
