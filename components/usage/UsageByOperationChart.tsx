import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdCents } from "@/lib/format/currency";
import {
  USAGE_OPERATION_LABELS,
  type UsageOperationType,
} from "@/lib/usage/usage-ledger";

type Row = {
  operationType: UsageOperationType;
  committedCents: number;
  count: number;
};

export function UsageByOperationChart({ rows }: { rows: Row[] }) {
  const max = rows.reduce((peak, row) => Math.max(peak, row.committedCents), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend by operation</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No usage recorded yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const widthPercent =
                max === 0 ? 0 : Math.round((row.committedCents / max) * 100);
              return (
                <li key={row.operationType} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{USAGE_OPERATION_LABELS[row.operationType]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatUsdCents(row.committedCents)} · {row.count}
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
