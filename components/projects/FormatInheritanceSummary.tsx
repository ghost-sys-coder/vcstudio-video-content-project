"use client";

import { ArrowDownRightIcon, PencilIcon } from "lucide-react";
import type { FormatFieldResolution } from "@/lib/formats/format-inheritance";

/**
 * Says plainly which settings came from the chosen format and which the creator
 * changed, so "inherited" is never something they have to infer.
 */
export function FormatInheritanceSummary({
  formatName,
  resolutions,
  versionNumber,
}: {
  formatName: string;
  resolutions: FormatFieldResolution[];
  versionNumber: number;
}) {
  const shown = resolutions.filter((row) => row.origin !== "unset");
  if (shown.length === 0) return null;
  const overridden = shown.filter((row) => row.origin === "overridden");

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="text-xs font-medium">
        Inheriting from {formatName} (v{versionNumber})
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {overridden.length === 0
          ? "Every setting below matches the format."
          : `${overridden.length} ${overridden.length === 1 ? "setting differs" : "settings differ"} from the format.`}{" "}
        This project keeps this version even if the format is edited later.
      </p>
      <ul className="mt-2 space-y-1">
        {shown.map((row) => (
          <li className="flex items-start gap-1.5 text-xs" key={row.field}>
            {row.origin === "inherited" ? (
              <ArrowDownRightIcon
                aria-hidden
                className="mt-0.5 size-3 shrink-0 text-muted-foreground"
              />
            ) : (
              <PencilIcon
                aria-hidden
                className="mt-0.5 size-3 shrink-0 text-amber-600"
              />
            )}
            <span
              className={
                row.origin === "overridden"
                  ? "text-amber-700 dark:text-amber-500"
                  : "text-muted-foreground"
              }
            >
              {row.label}: {row.effectiveValue}
              {row.origin === "overridden" && row.presetValue !== null
                ? ` (format: ${row.presetValue})`
                : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
