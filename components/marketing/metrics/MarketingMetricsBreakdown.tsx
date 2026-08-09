import type { MetricBreakdown } from "@/lib/marketing/metrics/quality-metrics";

export function MarketingMetricsBreakdown({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: MetricBreakdown[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length ? (
        <div className="mt-4 space-y-3">
          {rows.slice(0, 8).map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="truncate text-muted-foreground">
                {row.label}
              </span>
              <span className="font-medium tabular-nums">{row.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  );
}
