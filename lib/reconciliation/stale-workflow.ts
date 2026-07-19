/**
 * Pure selection of stale background runs: operations left in an active status
 * with no progress past a cutoff. This generalizes the per-operation expired-
 * reservation reconcilers' selection step so it can be unit-tested and reused.
 * Selection never mutates — callers decide what to do with the candidates.
 */

export type WorkflowRunSnapshot = {
  id: string;
  status: string;
  updatedAt: Date;
};

export function selectStaleRuns(input: {
  runs: WorkflowRunSnapshot[];
  now: Date;
  staleAfterMinutes: number;
  activeStatuses: readonly string[];
}): WorkflowRunSnapshot[] {
  if (!Number.isFinite(input.staleAfterMinutes) || input.staleAfterMinutes <= 0)
    throw new RangeError("staleAfterMinutes must be a positive number.");
  if (Number.isNaN(input.now.getTime()))
    throw new RangeError("now must be valid.");

  const cutoff = input.now.getTime() - input.staleAfterMinutes * 60_000;
  const active = new Set(input.activeStatuses);
  return input.runs.filter(
    (run) => active.has(run.status) && run.updatedAt.getTime() < cutoff,
  );
}
