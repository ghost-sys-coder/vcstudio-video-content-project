import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { MarketingMetricCard } from "@/components/marketing/metrics/MarketingMetricCard";
import { MarketingMetricsBreakdown } from "@/components/marketing/metrics/MarketingMetricsBreakdown";
import { MarketingMetricsRangeFilter } from "@/components/marketing/metrics/MarketingMetricsRangeFilter";
import { MarketingPublicationBreakdown } from "@/components/marketing/metrics/MarketingPublicationBreakdown";
import type { MarketingQualityPeriod } from "@/db/repositories/marketing-quality-metrics.repository";

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}
function hours(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}h`;
}
function money(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value / 100);
}

export function MarketingMetricsDashboard({
  days,
  current,
  previous,
}: {
  days: number;
  current: MarketingQualityPeriod;
  previous: MarketingQualityPeriod;
}) {
  const metrics = current.metrics;
  const ConfidenceIcon =
    metrics.sampleConfidence === "sufficient"
      ? CheckCircle2
      : metrics.sampleConfidence === "low"
        ? AlertTriangle
        : Info;
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8">
      <header className="space-y-3">
        <div>
          <p className="text-sm font-medium text-primary">
            Marketing Studio quality
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Quality metrics</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            A cohort view of content generated in the selected period, compared
            with the immediately preceding equal-length period.
          </p>
        </div>
        <MarketingMetricsRangeFilter days={days} />
      </header>
      <section
        className={`flex gap-3 rounded-2xl border p-4 ${metrics.sampleConfidence === "sufficient" ? "bg-emerald-500/5" : "bg-amber-500/5"}`}
      >
        <ConfidenceIcon className="mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="font-medium">
            {metrics.sampleConfidence === "sufficient"
              ? "Sufficient directional sample"
              : metrics.sampleConfidence === "low"
                ? "Low sample — avoid confident automation decisions"
                : "No generated content in this period"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Recommendations require at least 20 generated items. Current cohort:{" "}
            {metrics.generated}.
            {current.truncated
              ? " Results are capped at 5,000 items and should be narrowed."
              : ""}
          </p>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Primary quality outcomes</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MarketingMetricCard
            label="Approval rate"
            value={percent(metrics.approvalRate)}
            previous={percent(previous.metrics.approvalRate)}
            note="Approved generated items ÷ generated items with at least one review decision."
          />
          <MarketingMetricCard
            label="Substantive-edit rate"
            value={percent(metrics.substantiveEditRate)}
            previous={percent(previous.metrics.substantiveEditRate)}
            note="Human-edited items crossing 20% normalized text distance or changing structured fields."
          />
          <MarketingMetricCard
            label="Publication success"
            value={percent(metrics.publicationSuccessRate)}
            previous={percent(previous.metrics.publicationSuccessRate)}
            note="Successful terminal destinations ÷ successful plus failed terminal destinations."
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Volume and review speed</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MarketingMetricCard
            label="Generated"
            value={String(metrics.generated)}
            previous={String(previous.metrics.generated)}
            note="Content items with a frozen source generation run."
          />
          <MarketingMetricCard
            label="Reviewed"
            value={String(metrics.reviewed)}
            previous={String(previous.metrics.reviewed)}
            note="Generated items with an append-only review event."
          />
          <MarketingMetricCard
            label="First review"
            value={hours(metrics.averageFirstReviewHours)}
            previous={hours(previous.metrics.averageFirstReviewHours)}
            note="Average elapsed time from creation to first review decision."
          />
          <MarketingMetricCard
            label="Approval time"
            value={hours(metrics.averageApprovalHours)}
            previous={hours(previous.metrics.averageApprovalHours)}
            note="Average elapsed time from creation to first approval."
          />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Efficiency and guardrails
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MarketingMetricCard
            label="Duplicate-content rate"
            value={percent(metrics.duplicateContentRate)}
            previous={percent(previous.metrics.duplicateContentRate)}
            note="Generated items whose normalized current copy exactly matches another cohort item."
          />
          <MarketingMetricCard
            label="Cost per approved"
            value={money(metrics.costPerApprovedCents)}
            previous={money(previous.metrics.costPerApprovedCents)}
            note="Reconciled cohort generation cost ÷ approved generated items."
          />
          <MarketingMetricCard
            label="Cost per published"
            value={money(metrics.costPerPublishedCents)}
            previous={money(previous.metrics.costPerPublishedCents)}
            note="Reconciled cohort generation cost ÷ items with at least one published destination."
          />
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <MarketingPublicationBreakdown rows={metrics.publicationByPlatform} />
        <MarketingMetricsBreakdown
          title="Rejection reasons"
          rows={metrics.rejectionReasons}
          emptyMessage="No written rejection reasons in this cohort."
        />
        <MarketingMetricsBreakdown
          title="Models"
          rows={metrics.versions.model}
          emptyMessage="No model attribution recorded."
        />
        <MarketingMetricsBreakdown
          title="Prompt versions"
          rows={metrics.versions.prompt}
          emptyMessage="No prompt attribution recorded."
        />
        <MarketingMetricsBreakdown
          title="Skills"
          rows={metrics.versions.skill}
          emptyMessage="No skill attribution recorded."
        />
        <MarketingMetricsBreakdown
          title="Brand-context versions"
          rows={metrics.versions.brandContext}
          emptyMessage="No brand-context attribution recorded."
        />
      </section>
    </main>
  );
}
