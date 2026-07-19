"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { AUDIT_ACTION_LABELS } from "@/lib/audit/audit-actions";

const ACTIONS = Object.entries(AUDIT_ACTION_LABELS);

export function AuditLogFilters({ action }: { action: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("auditAction", value);
    else params.delete("auditAction");
    // Reset audit pagination when the filter changes.
    params.delete("auditPage");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm" htmlFor="audit-action-filter">
        Filter
      </Label>
      <select
        className="rounded-md border bg-background px-2 py-1 text-sm"
        id="audit-action-filter"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={action ?? ""}
      >
        <option value="">All actions</option>
        {ACTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
