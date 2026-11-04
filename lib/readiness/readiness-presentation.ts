import type { ReadinessItem, ReadinessStatus } from "./readiness";

export const READINESS_STATUS_PRESENTATION: Record<
  ReadinessStatus,
  { label: string; className: string }
> = {
  ready: {
    label: "Ready",
    className:
      "border-notice-ready-edge bg-notice-ready text-notice-ready-foreground",
  },
  degraded: {
    label: "Degraded",
    className:
      "border-notice-warning-edge bg-notice-warning text-notice-warning-foreground",
  },
  blocked: {
    label: "Blocked",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  disabled: { label: "Disabled", className: "bg-muted text-muted-foreground" },
  unknown: {
    label: "Unknown",
    className:
      "border-notice-info-edge bg-notice-info text-notice-info-foreground",
  },
};

/** Summarizes reported checks only; never performs a health probe. */
export function summarizeReadiness(items: ReadonlyArray<ReadinessItem>) {
  const counts: Record<ReadinessStatus, number> = {
    ready: 0,
    degraded: 0,
    blocked: 0,
    disabled: 0,
    unknown: 0,
  };
  for (const item of items) counts[item.status]++;
  const status: ReadinessStatus = counts.blocked
    ? "blocked"
    : counts.degraded
      ? "degraded"
      : counts.unknown || !items.length
        ? "unknown"
        : counts.ready
          ? "ready"
          : "disabled";
  return {
    counts,
    status,
    attention: counts.blocked + counts.degraded,
    total: items.length,
  };
}

const checkedDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
export function formatReadinessCheckedAt(value: Date): string {
  return `${checkedDate.format(value)} UTC`;
}
