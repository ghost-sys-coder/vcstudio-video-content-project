import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { ChartNoAxesCombined } from "lucide-react";
import { Empty } from "@/components/ui/Empty";
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
    <Card className="min-w-0">
      <CardHeader className="border-b">
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-secondary">
          <ChartNoAxesCombined aria-hidden="true" className="size-5" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          Spend by operation
        </h2>
        <CardDescription>
          Committed costs across recorded operations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty>
            <ChartNoAxesCombined
              aria-hidden="true"
              className="size-6 text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              No usage recorded yet.
            </p>
          </Empty>
        ) : (
          <ul className="space-y-5">
            {rows.map((row) => {
              const widthPercent =
                max === 0 ? 0 : Math.round((row.committedCents / max) * 100);
              return (
                <li key={row.operationType} className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span>{USAGE_OPERATION_LABELS[row.operationType]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatUsdCents(row.committedCents)} · {row.count}{" "}
                      {row.count === 1 ? "operation" : "operations"}
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
