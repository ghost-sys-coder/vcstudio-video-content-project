import type { ProductionRunGateView } from "@/lib/production-runs/production-run-view";

const VERDICT_CLASSES = {
  pass: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  fail: "text-destructive",
} as const;

/**
 * Every check the run made, with the numbers behind it.
 *
 * Shown in full rather than as a count because the checks are the evidence
 * for letting the run decide more on its own later; a creator who spot-checks
 * them is doing the review the roadmap asks for.
 */
export function ProductionRunGateSummary({
  gates,
  summary,
}: {
  gates: ProductionRunGateView[];
  summary: { passed: number; warned: number; failed: number };
}) {
  if (gates.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No checks recorded yet.</p>
    );
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {summary.passed} passed · {summary.warned} warned · {summary.failed}{" "}
        failed
      </p>
      <ul className="space-y-1.5 text-sm">
        {gates
          .slice()
          .reverse()
          .slice(0, 60)
          .map((gate) => (
            <li className="flex flex-wrap gap-x-2" key={gate.id}>
              <span
                className={`shrink-0 font-medium ${VERDICT_CLASSES[gate.verdict]}`}
              >
                {gate.verdict.toUpperCase()}
              </span>
              <span className="shrink-0">{gate.label}</span>
              {gate.score !== null ? (
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {gate.score}/100
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {gate.reasons.join(" ")}
                {gate.accepted ? " Accepted by the run." : ""}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
