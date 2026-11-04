"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
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
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Label className="shrink-0 text-sm" htmlFor="audit-action-filter">
        Filter
      </Label>
      <FormSelect
        className="w-full sm:w-64"
        id="audit-action-filter"
        onValueChange={(selectedValue) => onChange(selectedValue)}
        value={action ?? ""}
      >
        <SelectItem value="">All actions</SelectItem>
        {ACTIONS.map(([value, label]) => (
          <SelectItem key={value} value={String(value)}>
            {label}
          </SelectItem>
        ))}
      </FormSelect>
    </div>
  );
}
