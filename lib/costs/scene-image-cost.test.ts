import { describe, expect, it } from "vitest";
import {
  calculateActualSceneImageCostCents,
  estimateBulkSceneImageCostCents,
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

  describe("estimateBulkSceneImageCostCents", () => {
    it("sums the per-size output cost, multiplied by scene count", () => {
      // One landscape (2) + one square (1) = 3 cents/scene x 4 scenes = 12.
      expect(
        estimateBulkSceneImageCostCents({
          sceneCount: 4,
          quality: "low",
          sizes: ["1536x1024", "1024x1024"],
          outputCostMatrix,
        }),
      ).toBe(12);
    });

    it("matches the single-size result when only one size is selected", () => {
      expect(
        estimateBulkSceneImageCostCents({
          sceneCount: 5,
          quality: "medium",
          sizes: ["1536x1024"],
          outputCostMatrix,
        }),
      ).toBe(35);
    });

    it("rejects an empty size selection", () => {
      expect(() =>
        estimateBulkSceneImageCostCents({
          sceneCount: 3,
          quality: "low",
          sizes: [],
          outputCostMatrix,
        }),
      ).toThrow(RangeError);
    });

    it("rejects a negative scene count", () => {
      expect(() =>
        estimateBulkSceneImageCostCents({
          sceneCount: -1,
          quality: "low",
          sizes: ["1024x1024"],
          outputCostMatrix,
        }),
      ).toThrow(RangeError);
    });
  });
});
