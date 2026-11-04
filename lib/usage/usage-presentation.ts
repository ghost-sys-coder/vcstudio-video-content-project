import type { AuditMetadata } from "@/lib/audit/audit-actions";

export function budgetProgress(spentCents: number, budgetCents: number) {
  const percent =
    budgetCents === 0
      ? spentCents > 0
        ? 100
        : 0
      : Math.min(100, Math.round((spentCents / budgetCents) * 100));
  return {
    percent,
    over: spentCents > budgetCents,
    remainingCents: Math.max(0, budgetCents - spentCents),
  };
}

export function formatBudgetDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function summarizeAuditMetadata(metadata: AuditMetadata): string {
  return Object.entries(metadata)
    .filter(([, value]) => value !== null)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}
