import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdCents } from "@/lib/format/currency";

type Window = { label: string; spentCents: number; budgetCents: number };

function ProgressRow({ label, spentCents, budgetCents }: Window) {
  const ratio = budgetCents === 0 ? 1 : spentCents / budgetCents;
  const percent = Math.min(100, Math.round(ratio * 100));
  const over = spentCents > budgetCents;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatUsdCents(spentCents)} / {formatUsdCents(budgetCents)}
        </span>
      </div>
      <div
        aria-hidden
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="presentation"
      >
        <div
          className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function BudgetProgress({
  dayToDateCents,
  dailyBudgetCents,
  monthToDateCents,
  monthlyBudgetCents,
}: {
  dayToDateCents: number;
  dailyBudgetCents: number;
  monthToDateCents: number;
  monthlyBudgetCents: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProgressRow
          label="Today"
          spentCents={dayToDateCents}
          budgetCents={dailyBudgetCents}
        />
        <ProgressRow
          label="This month"
          spentCents={monthToDateCents}
          budgetCents={monthlyBudgetCents}
        />
      </CardContent>
    </Card>
  );
}
