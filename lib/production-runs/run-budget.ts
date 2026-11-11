/**
 * The run's own spending ceiling.
 *
 * Every billable stage already reserves against the project and workspace
 * budgets. This ceiling sits inside those: it is the most one unattended run
 * may commit in total, so a run cannot quietly consume a whole project budget
 * through retries. Spent is the sum of the estimates the run has caused, read
 * from the rows it created, never a counter it maintains on its own.
 */
export type RunBudgetDecision =
  | { allowed: true; remainingCents: number }
  | { allowed: false; reason: string };

export function decideRunBudget(input: {
  spentCents: number;
  estimateCents: number;
  maximumCents: number;
  what: string;
}): RunBudgetDecision {
  const remaining = input.maximumCents - input.spentCents;
  if (input.estimateCents > remaining)
    return {
      allowed: false,
      reason: `${input.what} is estimated at ${formatCents(input.estimateCents)}, but only ${formatCents(Math.max(0, remaining))} of this run's ${formatCents(input.maximumCents)} ceiling remains.`,
    };
  return { allowed: true, remainingCents: remaining - input.estimateCents };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
