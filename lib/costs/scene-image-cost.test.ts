import { describe, expect, it } from "vitest";
import {
  calculateActualSceneImageCostCents,
  estimateSceneImageCost,
  reconcileSceneImageCost,
  type SceneImageOutputCostMatrix,
} from "@/lib/costs/scene-image-cost";

const outputCostMatrix: SceneImageOutputCostMatrix = {
  low: {
    "1024x1024": 1,
    "1536x1024": 2,
    "1024x1536": 2,
  },
  medium: {
    "1024x1024": 5,
    "1536x1024": 7,
    "1024x1536": 7,
  },
  high: {
    "1024x1024": 20,
    "1536x1024": 25,
    "1024x1536": 25,
  },
};

describe("scene image costs", () => {
  it("creates a conservative reservation with reference and safety margins", () => {
    const estimate = estimateSceneImageCost({
      prompt: "x".repeat(4_000),
      quality: "medium",
      size: "1536x1024",
      referenceAssetCount: 2,
      outputCostMatrix,
      textInputCostPerMillionCents: 500,
      referenceInputReserveCents: 2,
      safetyMarginBasisPoints: 2_000,
    });
    expect(estimate.textInputTokens).toBe(1_000);
    expect(estimate.outputCostCents).toBe(7);
    expect(estimate.referenceInputCostCents).toBe(4);
    expect(estimate.estimatedCostCents).toBeGreaterThan(
      estimate.outputCostCents + estimate.referenceInputCostCents,
    );
  });

  it("calculates actual cost from provider token usage", () => {
    expect(
      calculateActualSceneImageCostCents({
        usage: {
          inputTextTokens: 1_000,
          inputImageTokens: 2_000,
          outputTokens: 5_000,
          totalTokens: 8_000,
        },
        rates: {
          textInputCostPerMillionCents: 500,
          imageInputCostPerMillionCents: 1_000,
          outputCostPerMillionCents: 4_000,
        },
      }),
    ).toBe(23);
  });

  it("releases unused reservation and records overage", () => {
    expect(
      reconcileSceneImageCost({
        reservedCostCents: 30,
        actualCostCents: 22,
      }),
    ).toEqual({
      costBasis: "provider_usage",
      chargedCostCents: 22,
      releasedCostCents: 8,
      overageCostCents: 0,
    });
    expect(
      reconcileSceneImageCost({
        reservedCostCents: 20,
        actualCostCents: 25,
      }).overageCostCents,
    ).toBe(5);
  });

  it("uses the reservation as the safe charge fallback when usage is absent", () => {
    expect(
      reconcileSceneImageCost({
        reservedCostCents: 18,
        actualCostCents: null,
      }),
    ).toEqual({
      costBasis: "estimate_fallback",
      chargedCostCents: 18,
      releasedCostCents: 0,
      overageCostCents: 0,
    });
  });
});
