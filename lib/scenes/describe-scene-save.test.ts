import { describe, expect, it } from "vitest";
import { describeSceneSaveImpact } from "@/lib/scenes/describe-scene-save";
import type { SceneRevisionEstimateView } from "@/lib/scenes/scene-revision-view";

function estimate(
  overrides: Partial<SceneRevisionEstimateView> = {},
): SceneRevisionEstimateView {
  return {
    lines: [],
    estimatedCostCents: 0,
    unavailableCount: 0,
    affectedMediaCount: 0,
    ...overrides,
  };
}

describe("describeSceneSaveImpact", () => {
  it("does not interrupt an edit that destroys nothing", () => {
    // The whole point of asking: a scene with no generated media, or an edit
    // that keeps it, costs the creator nothing and should just save.
    expect(describeSceneSaveImpact(estimate()).needsConfirmation).toBe(false);
  });

  it("interrupts an edit that invalidates finished work", () => {
    const summary = describeSceneSaveImpact(
      estimate({ affectedMediaCount: 1, estimatedCostCents: 4 }),
    );
    expect(summary.needsConfirmation).toBe(true);
    expect(summary.lead).toContain("1 finished asset");
    expect(summary.lead).toContain("$0.04");
  });

  it("counts every invalidated asset, not just the priced ones", () => {
    const summary = describeSceneSaveImpact(
      estimate({
        affectedMediaCount: 3,
        estimatedCostCents: 12,
        unavailableCount: 1,
      }),
    );
    expect(summary.lead).toContain("3 finished assets");
  });

  // A recorded voice-over or an uploaded image is destroyed just the same and
  // cannot be priced. Showing "$0.00" there would read as "this is free", which
  // is the opposite of what is happening.
  it("never prices unpriceable work at zero", () => {
    const summary = describeSceneSaveImpact(
      estimate({
        affectedMediaCount: 1,
        estimatedCostCents: 0,
        unavailableCount: 1,
      }),
    );
    expect(summary.needsConfirmation).toBe(true);
    expect(summary.lead).not.toContain("$0.00");
    expect(summary.lead).toContain("cannot be priced");
  });

  it("says a partial estimate is a floor rather than a total", () => {
    const summary = describeSceneSaveImpact(
      estimate({
        affectedMediaCount: 2,
        estimatedCostCents: 9,
        unavailableCount: 1,
      }),
    );
    expect(summary.lead).toContain("at least $0.09");
  });

  // Saving starts no generation and reserves no budget, so a confirm label
  // promising to spend would be a lie.
  it("does not promise to spend money, because saving spends none", () => {
    const summary = describeSceneSaveImpact(
      estimate({ affectedMediaCount: 1, estimatedCostCents: 40 }),
    );
    expect(summary.confirmLabel).toBe("Save anyway");
    expect(summary.confirmLabel).not.toContain("$");
  });
});
