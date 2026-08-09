"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FailurePresentation } from "@/lib/failures/failure-recovery";

export function FailureRecoveryActions({
  recovery,
}: {
  recovery: FailurePresentation;
}) {
  const [copyStatus, setCopyStatus] = useState<
    { value: string; state: "copied" | "failed" } | undefined
  >();
  return (
    <aside
      className="mt-3 space-y-2 rounded-xl border bg-muted/40 p-3"
      aria-label="Recovery guidance"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-medium">{recovery.heading}</h3>
          <p className="text-xs text-muted-foreground">{recovery.guidance}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {recovery.actions.map((action) => {
          if (action.kind === "link")
            return (
              <Button
                key={`${action.kind}:${action.label}`}
                nativeButton={false}
                size="sm"
                variant="outline"
                render={<Link href={action.href} />}
              >
                <ExternalLink />
                {action.label}
              </Button>
            );
          if (action.kind === "instruction")
            return (
              <span
                key={`${action.kind}:${action.label}`}
                className="inline-flex h-7 items-center rounded-lg border bg-background px-2.5 text-xs font-medium"
              >
                {action.label}
              </span>
            );
          const copied =
            copyStatus?.value === action.value && copyStatus.state === "copied";
          const copyFailed =
            copyStatus?.value === action.value && copyStatus.state === "failed";
          return (
            <Button
              key={`${action.kind}:${action.label}`}
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(action.value);
                  setCopyStatus({ value: action.value, state: "copied" });
                } catch {
                  setCopyStatus({ value: action.value, state: "failed" });
                }
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : copyFailed ? "Copy failed" : action.label}
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
