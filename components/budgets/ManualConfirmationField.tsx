"use client";

import { requiresManualConfirmation } from "@/lib/budgets/budget-settings";
import { formatUsdCents } from "@/lib/format/currency";

/**
 * Renders a required confirmation checkbox only when an estimate reaches the
 * workspace's manual-confirmation threshold. Below the threshold it renders
 * nothing and the parent should treat confirmation as satisfied.
 */
export function ManualConfirmationField({
  estimatedCostCents,
  thresholdCents,
  checked,
  onChange,
  disabled,
}: {
  estimatedCostCents: number;
  thresholdCents: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  if (!requiresManualConfirmation(estimatedCostCents, thresholdCents))
    return null;

  return (
    <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <input
        checked={checked}
        className="mt-0.5"
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span>
        This estimate ({formatUsdCents(estimatedCostCents)}) is at or above the{" "}
        {formatUsdCents(thresholdCents)} confirmation threshold. Confirm you
        want to proceed.
      </span>
    </label>
  );
}
