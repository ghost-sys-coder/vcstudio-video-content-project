import { describe, expect, it } from "vitest";
import {
  calculateAvailableSceneImageBudgetCents,
  findSceneImageBudgetConstraint,
  getUtcBudgetWindowStarts,
  type SceneImageBudgetSnapshot,
} from "@/lib/scenes/scene-image-budget";

const snapshot: SceneImageBudgetSnapshot = {
  projectLimitCents: 200,
  projectCommittedCents: 20,
  workspaceDailyLimitCents: 100,
  workspaceDailyCommittedCents: 30,
  workspaceMonthlyLimitCents: 1_000,
  workspaceMonthlyCommittedCents: 400,
};

describe("scene image budget availability", () => {
  it("returns the tightest remaining budget", () => {
    expect(calculateAvailableSceneImageBudgetCents(snapshot)).toBe(70);
  });

  it("identifies the first budget boundary that would be exceeded", () => {
    expect(
      findSceneImageBudgetConstraint({ snapshot, estimatedCostCents: 71 }),
    ).toBe("workspaceDaily");
    expect(
      findSceneImageBudgetConstraint({ snapshot, estimatedCostCents: 70 }),
    ).toBeNull();
  });

  it("never exposes a negative available amount", () => {
    expect(
      calculateAvailableSceneImageBudgetCents({
        ...snapshot,
        projectCommittedCents: 250,
      }),
    ).toBe(0);
  });

  it("uses UTC boundaries for daily and monthly limits", () => {
    expect(
      getUtcBudgetWindowStarts(new Date("2026-07-17T23:40:00-04:00")),
    ).toEqual({
      dailyWindowStart: new Date("2026-07-18T00:00:00.000Z"),
      monthlyWindowStart: new Date("2026-07-01T00:00:00.000Z"),
    });
  });
});
