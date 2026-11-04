import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/Progress";
import { formatUsdCents } from "@/lib/format/currency";
import { budgetProgress } from "@/lib/usage/usage-presentation";

export function BudgetProgressRow({
  label,
  spentCents,
  budgetCents,
}: {
  label: string;
  spentCents: number;
  budgetCents: number;
}) {
  const progress = budgetProgress(spentCents, budgetCents);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {progress.over && <Badge variant="destructive">Over budget</Badge>}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold tabular-nums">
          {formatUsdCents(spentCents)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            of {formatUsdCents(budgetCents)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {budgetCents === 0
            ? "No budget available"
            : `${formatUsdCents(progress.remainingCents)} remaining`}
        </p>
      </div>
      <Progress
        aria-label={`${label} budget usage`}
        aria-valuetext={`${formatUsdCents(spentCents)} committed of ${formatUsdCents(budgetCents)} budget`}
        value={progress.percent}
        className={
          progress.over
            ? "[&_[data-slot=progress-indicator]]:bg-destructive"
            : undefined
        }
      />
    </div>
  );
}
