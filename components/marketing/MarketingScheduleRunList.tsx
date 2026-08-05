import type { MarketingScheduleRuleRun } from "@/db/schema";

export function MarketingScheduleRunList({
  runs,
}: {
  runs: { run: MarketingScheduleRuleRun; ruleName: string }[];
}) {
  if (runs.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No recurring run has been claimed yet.
      </p>
    );
  return (
    <div className="divide-y rounded-xl border">
      {runs.map(({ run, ruleName }) => (
        <div className="grid gap-1 p-3 text-sm sm:grid-cols-4" key={run.id}>
          <span className="font-medium">{ruleName}</span>
          <span>{run.scheduledFor.toLocaleString()}</span>
          <span>{run.status}</span>
          <span className="text-muted-foreground">
            {run.skipReason ??
              run.safeErrorMessage ??
              `${run.createdContentItemIds.length} item(s)`}
          </span>
        </div>
      ))}
    </div>
  );
}
