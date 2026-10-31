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
    <div className="flex items-center gap-2">
      <Label className="text-sm" htmlFor="audit-action-filter">
        Filter
      </Label>
      <FormSelect
        className="w-auto"
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
