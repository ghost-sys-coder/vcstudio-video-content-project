import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdCents } from "@/lib/format/currency";
import { marketingOperationLabel } from "@/lib/usage/marketing-usage-ledger";

export function MarketingSpendCard({
  monthToDateCents,
  monthlyBudgetCents,
  byOperation,
}: {
  monthToDateCents: number;
  monthlyBudgetCents: number | null;
  byOperation: { operation: string; committedCents: number; runs: number }[];
}) {
  const max = byOperation.reduce(
    (peak, row) => Math.max(peak, row.committedCents),
    0,
  );
  const usedPercent =
    monthlyBudgetCents === null || monthlyBudgetCents === 0
      ? null
      : Math.min(
          100,
          Math.round((monthToDateCents / monthlyBudgetCents) * 100),
        );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marketing spend this month</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-2xl font-semibold tabular-nums">
            {formatUsdCents(monthToDateCents)}
          </p>
          <p className="text-sm text-muted-foreground">
            {monthlyBudgetCents === null
              ? "No marketing sub-cap set. Marketing spends from the workspace budget."
              : `${formatUsdCents(monthlyBudgetCents)} marketing cap · counts toward the workspace budget`}
          </p>
        </div>

        {usedPercent !== null && (
          <div
            aria-hidden
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        )}

        {byOperation.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No marketing usage recorded yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {byOperation.map((row) => {
              const widthPercent =
                max === 0 ? 0 : Math.round((row.committedCents / max) * 100);
              return (
                <li key={row.operation} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{marketingOperationLabel(row.operation)}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatUsdCents(row.committedCents)} · {row.runs}
                    </span>
                  </div>
                  <div
                    aria-hidden
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
