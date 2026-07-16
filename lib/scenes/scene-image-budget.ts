export type SceneImageBudgetSnapshot = {
  projectLimitCents: number;
  projectCommittedCents: number;
  workspaceDailyLimitCents: number;
  workspaceDailyCommittedCents: number;
  workspaceMonthlyLimitCents: number;
  workspaceMonthlyCommittedCents: number;
};

export type SceneImageBudgetConstraint =
  "project" | "workspaceDaily" | "workspaceMonthly";

function assertNonnegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`${label} must be a nonnegative integer.`);
}

function remaining(limit: number, committed: number): number {
  return Math.max(0, limit - committed);
}

export function getUtcBudgetWindowStarts(now: Date): {
  dailyWindowStart: Date;
  monthlyWindowStart: Date;
} {
  if (Number.isNaN(now.getTime())) throw new RangeError("Now must be valid.");
  return {
    dailyWindowStart: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ),
    monthlyWindowStart: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ),
  };
}

export function calculateAvailableSceneImageBudgetCents(
  snapshot: SceneImageBudgetSnapshot,
): number {
  Object.entries(snapshot).forEach(([label, value]) =>
    assertNonnegativeInteger(value, label),
  );
  return Math.min(
    remaining(snapshot.projectLimitCents, snapshot.projectCommittedCents),
    remaining(
      snapshot.workspaceDailyLimitCents,
      snapshot.workspaceDailyCommittedCents,
    ),
    remaining(
      snapshot.workspaceMonthlyLimitCents,
      snapshot.workspaceMonthlyCommittedCents,
    ),
  );
}

export function findSceneImageBudgetConstraint(input: {
  snapshot: SceneImageBudgetSnapshot;
  estimatedCostCents: number;
}): SceneImageBudgetConstraint | null {
  assertNonnegativeInteger(
    input.estimatedCostCents,
    "Estimated scene image cost",
  );
  const snapshot = input.snapshot;
  Object.entries(snapshot).forEach(([label, value]) =>
    assertNonnegativeInteger(value, label),
  );
  if (
    snapshot.projectCommittedCents + input.estimatedCostCents >
    snapshot.projectLimitCents
  )
    return "project";
  if (
    snapshot.workspaceDailyCommittedCents + input.estimatedCostCents >
    snapshot.workspaceDailyLimitCents
  )
    return "workspaceDaily";
  if (
    snapshot.workspaceMonthlyCommittedCents + input.estimatedCostCents >
    snapshot.workspaceMonthlyLimitCents
  )
    return "workspaceMonthly";
  return null;
}
