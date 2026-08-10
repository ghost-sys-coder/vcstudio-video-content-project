import { AlertTriangle, BarChart3 } from "lucide-react";
import type { PerformanceDashboard } from "@/db/repositories/publication-performance.repository";
import { ANALYTICS_CAPABILITIES } from "@/lib/marketing/performance/performance-metrics";

const LABELS = {
  impressions: "Impressions",
  views: "Views",
  watch_time: "Watch time",
  retention: "Retention",
  engagement: "Engagement actions",
  clicks: "Clicks",
  conversions: "Conversions",
} as const;

export function PerformanceFeedbackPanel({
  dashboard,
}: {
  dashboard: PerformanceDashboard;
}) {
  return (
    <section className="space-y-5 border-t pt-8">
      <div className="flex items-start gap-3">
        <BarChart3 className="mt-1 size-5 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Publication performance</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Directional provider observations tied to the exact published copy
            and generation context. Comparisons show correlations and
            experiments—not causes, forecasts, or guarantees.
          </p>
        </div>
      </div>
      {dashboard.sources === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          No published destinations have been discovered yet. The bounded
          six-hour sync will add eligible publications without changing older
          quality cohorts.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(dashboard.latestTotals).map(([metric, value]) => (
            <div key={metric} className="rounded-2xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                {LABELS[metric as keyof typeof LABELS]}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {Math.round(value).toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Latest lifetime values; only like-for-like raw metrics are
                summed.
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-medium">Provider coverage</h3>
          <div className="mt-4 space-y-4">
            {ANALYTICS_CAPABILITIES.map((capability) => {
              const coverage = dashboard.platforms.find(
                (entry) => entry.platform === capability.platform,
              );
              return (
                <div key={capability.platform} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="capitalize">{capability.platform}</span>
                    <span className="text-muted-foreground">
                      {coverage
                        ? `${coverage.observed}/${coverage.sources} observed`
                        : capability.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {capability.requirement}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-medium">Latest observations</h3>
          {dashboard.recent.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Metrics are explicitly missing until a supported provider returns
              them; missing never means zero.
            </p>
          ) : (
            <div className="mt-4 max-h-96 space-y-3 overflow-auto">
              {dashboard.recent.map((row) => (
                <div
                  key={`${row.sourceId}:${row.rawMetricKey}:${row.observedAt.toISOString()}`}
                  className="rounded-xl bg-muted/45 p-3 text-sm"
                >
                  <div className="flex justify-between gap-4">
                    <span className="capitalize">
                      {row.platform} · {LABELS[row.metricKind]}
                    </span>
                    <span className="font-medium tabular-nums">
                      {row.value.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {row.titleOrCaption || "Untitled publication"}
                  </p>
                  {!row.comparableGroup ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-3" /> Not cross-platform
                      comparable
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Google Business Profile facts are not used as performance observations.
        Listing provenance remains isolated in brand grounding and is never
        merged into these provider snapshots.
      </p>
    </section>
  );
}
