import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdCents } from "@/lib/format/currency";
import {
  formatLedgerTimestamp,
  USAGE_OPERATION_LABELS,
  USAGE_STATUS_LABELS,
  type UsageLedgerEntry,
} from "@/lib/usage/usage-ledger";

export function UsageEventTable({
  items,
  page,
  pageCount,
  total,
  prevHref,
  nextHref,
}: {
  items: UsageLedgerEntry[];
  page: number;
  pageCount: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage ledger</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No usage events recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">When (UTC)</th>
                  <th className="py-2 pr-4 font-medium">Operation</th>
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Estimated
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">Actual</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr
                    key={entry.reservationId}
                    className="border-b last:border-0"
                  >
                    <td className="py-2 pr-4 tabular-nums whitespace-nowrap">
                      {formatLedgerTimestamp(entry.createdAt)}
                    </td>
                    <td className="py-2 pr-4">
                      {USAGE_OPERATION_LABELS[entry.operationType]}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {entry.model ?? entry.provider ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {entry.requestedByName ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatUsdCents(entry.reservedCostCents)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {entry.actualCostCents === null
                        ? "—"
                        : formatUsdCents(entry.actualCostCents)}
                    </td>
                    <td className="py-2">
                      <Badge
                        variant={
                          entry.status === "released" ? "outline" : "secondary"
                        }
                      >
                        {USAGE_STATUS_LABELS[entry.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {pageCount} · {total} events
          </span>
          <div className="flex gap-2">
            {prevHref ? (
              <Link
                className="rounded-md border px-3 py-1 hover:bg-muted"
                href={prevHref}
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border px-3 py-1 opacity-50">
                Previous
              </span>
            )}
            {nextHref ? (
              <Link
                className="rounded-md border px-3 py-1 hover:bg-muted"
                href={nextHref}
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border px-3 py-1 opacity-50">
                Next
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
