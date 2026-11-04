import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Table } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import { ReceiptText } from "lucide-react";
import { UsagePagination } from "./UsagePagination";
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
    <Card className="min-w-0">
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-secondary">
            <ReceiptText aria-hidden="true" className="size-4" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Usage ledger</h2>
        </div>
        <CardDescription>
          Inspect reservations, actual costs and settlement states.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty>
            <p className="text-sm text-muted-foreground">
              No usage events recorded yet.
            </p>
          </Empty>
        ) : (
          <Table aria-label="Usage ledger">
            <thead className="bg-muted/60">
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">When (UTC)</th>
                <th className="py-2 pr-4 font-medium">Operation</th>
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 text-right font-medium">Estimated</th>
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
                  <td className="py-2 pr-4">{entry.requestedByName ?? "—"}</td>
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
                      variant="outline"
                      className={
                        entry.status === "reconciled"
                          ? "border-notice-ready-edge bg-notice-ready text-notice-ready-foreground"
                          : entry.status === "pending"
                            ? "border-notice-warning-edge bg-notice-warning text-notice-warning-foreground"
                            : "bg-muted text-muted-foreground"
                      }
                    >
                      {USAGE_STATUS_LABELS[entry.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <UsagePagination
          label="Usage ledger"
          page={page}
          pageCount={pageCount}
          total={total}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </CardContent>
    </Card>
  );
}
