import { Activity, Clock3 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  formatReadinessCheckedAt,
  summarizeReadiness,
} from "@/lib/readiness/readiness-presentation";
import type { ReadinessView } from "@/lib/readiness/readiness";
import { ReadinessStatusBadge } from "./ReadinessStatusBadge";

export function ReadinessOverview({ view }: { view: ReadinessView }) {
  const summary = summarizeReadiness([...view.deployment, ...view.workspace]);
  const metrics = [
    { label: "Ready", count: summary.counts.ready },
    { label: "Need attention", count: summary.attention },
    { label: "Disabled", count: summary.counts.disabled },
    { label: "Unknown", count: summary.counts.unknown },
  ];
  return (
    <Card className="min-w-0 bg-secondary/25 shadow-none">
      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/20">
            <Activity aria-hidden="true" className="size-5" />
          </div>
          <div className="app-heading">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Readiness overview
              </h2>
              <ReadinessStatusBadge status={summary.status} />
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {summary.attention
                ? "Review the highlighted checks below for the next steps."
                : summary.counts.unknown || !summary.total
                  ? "Some readiness information is unavailable. Review the reported checks below."
                  : summary.status === "disabled"
                    ? "These checks are disabled and are separate from reported failures."
                    : "Reported checks are ready. Disabled services remain separate from failures."}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:shrink-0">
          {metrics.map((metric) => (
            <div key={metric.label} className="space-y-1">
              <dt className="text-xs font-medium text-muted-foreground">
                {metric.label}
              </dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {metric.count}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="gap-2 bg-transparent text-xs text-muted-foreground">
        <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
        <p>
          Last checked{" "}
          <time dateTime={view.checkedAt}>
            {formatReadinessCheckedAt(view.checkedAt)}
          </time>
        </p>
      </CardFooter>
    </Card>
  );
}
