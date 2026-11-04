import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Table } from "@/components/ui/Table";
import { Empty } from "@/components/ui/Empty";
import { History } from "lucide-react";
import { UsagePagination } from "./UsagePagination";
import { summarizeAuditMetadata } from "@/lib/usage/usage-presentation";
import type { AuditLogEntry } from "@/db/repositories/audit-log.repository";
import { AUDIT_ACTION_LABELS } from "@/lib/audit/audit-actions";
import { formatLedgerTimestamp } from "@/lib/usage/usage-ledger";

export function AuditLogTable({
  items,
  page,
  pageCount,
  total,
  prevHref,
  nextHref,
  filter,
}: {
  items: AuditLogEntry[];
  page: number;
  pageCount: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
  filter?: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="border-b">
        <div className="app-page-header items-center">
          <div className="app-heading">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-secondary">
                <History aria-hidden="true" className="size-4" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">
                Audit trail
              </h2>
            </div>
            <CardDescription>
              A record of workspace actions and who performed them.
            </CardDescription>
          </div>
          {filter}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty>
            <p className="text-sm text-muted-foreground">
              No audit events recorded yet.
            </p>
          </Empty>
        ) : (
          <Table aria-label="Audit trail">
            <thead className="bg-muted/60">
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">When (UTC)</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Actor</th>
                <th className="py-2 pr-4 font-medium">Target</th>
                <th className="py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 tabular-nums whitespace-nowrap">
                    {formatLedgerTimestamp(entry.createdAt)}
                  </td>
                  <td className="py-2 pr-4">
                    {AUDIT_ACTION_LABELS[entry.action]}
                  </td>
                  <td className="py-2 pr-4">{entry.actorName ?? "System"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {entry.targetType}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {summarizeAuditMetadata(entry.safeMetadata) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <UsagePagination
          label="Audit trail"
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
