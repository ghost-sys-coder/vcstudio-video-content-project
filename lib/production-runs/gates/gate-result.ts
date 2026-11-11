import type { GateVerdict } from "@/lib/production-runs/production-run-state";

/**
 * The outcome of one deterministic check.
 *
 * A gate never guesses: every reason it records is something it measured from
 * stored data. `warn` means the output is usable but a person might want to
 * look; `fail` means the run must not accept it on its own.
 */
export interface GateResult {
  verdict: GateVerdict;
  /** 0–100 where present; omitted when the check is pass/fail only. */
  score: number | null;
  reasons: string[];
}

export function pass(
  reasons: string[] = [],
  score: number | null = null,
): GateResult {
  return { verdict: "pass", score, reasons };
}

export function warn(
  reasons: string[],
  score: number | null = null,
): GateResult {
  return { verdict: "warn", score, reasons };
}

export function fail(
  reasons: string[],
  score: number | null = null,
): GateResult {
  return { verdict: "fail", score, reasons };
}

/** The strictest of several results, with every reason kept. */
export function combineGateResults(results: GateResult[]): GateResult {
  const reasons = results.flatMap((result) => result.reasons);
  const scores = results
    .map((result) => result.score)
    .filter((score): score is number => score !== null);
  const score = scores.length ? Math.min(...scores) : null;
  if (results.some((result) => result.verdict === "fail"))
    return fail(reasons, score);
  if (results.some((result) => result.verdict === "warn"))
    return warn(reasons, score);
  return pass(reasons, score);
}
