import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditLogEntry } from "@/db/repositories/audit-log.repository";
import { AUDIT_ACTION_LABELS } from "@/lib/audit/audit-actions";
import { formatLedgerTimestamp } from "@/lib/usage/usage-ledger";

function summarizeMetadata(metadata: AuditLogEntry["safeMetadata"]): string {
  const parts = Object.entries(metadata)
    .filter(([, value]) => value !== null)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`);
  return parts.join(" · ");
}

export function AuditLogTable({
  items,
  page,
  pageCount,
  total,
  prevHref,
  nextHref,
}: {
  items: AuditLogEntry[];
  page: number;
  pageCount: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No audit events recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
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
                      {summarizeMetadata(entry.safeMetadata) || "—"}
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
