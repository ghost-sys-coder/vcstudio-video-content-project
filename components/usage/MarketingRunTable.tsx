import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketingGenerationRun } from "@/db/schema";
import { formatUsdCents } from "@/lib/format/currency";
import {
  MARKETING_RUN_STATUS_LABELS,
  marketingOperationLabel,
} from "@/lib/usage/marketing-usage-ledger";
import { formatLedgerTimestamp } from "@/lib/usage/usage-ledger";

export function MarketingRunTable({
  runs,
}: {
  runs: MarketingGenerationRun[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent marketing runs</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No marketing runs yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">When (UTC)</th>
                  <th className="py-2 pr-4 font-medium">Operation</th>
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Estimated
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">Actual</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 tabular-nums whitespace-nowrap">
                      {formatLedgerTimestamp(run.createdAt)}
                    </td>
                    <td className="py-2 pr-4">
                      {marketingOperationLabel(run.operation)}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {run.model === "" ? "—" : run.model}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatUsdCents(run.estimatedCostCents)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {run.actualCostCents === null
                        ? "—"
                        : formatUsdCents(run.actualCostCents)}
                    </td>
                    <td className="py-2">
                      <Badge
                        variant={
                          run.status === "failed" || run.status === "cancelled"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {MARKETING_RUN_STATUS_LABELS[run.status]}
                      </Badge>
                      {/* The safe message is the only failure detail a user
                          sees; the raw provider error stays in Sentry. */}
                      {run.safeErrorMessage && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {run.safeErrorMessage}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
