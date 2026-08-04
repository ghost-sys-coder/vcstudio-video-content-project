import { MarketingRunTable } from "@/components/usage/MarketingRunTable";
import { MarketingSpendCard } from "@/components/usage/MarketingSpendCard";
import type { MarketingUsageView } from "@/lib/usage/marketing-usage-view";

export function MarketingUsageSection({ view }: { view: MarketingUsageView }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Marketing Studio</h2>
        <p className="text-sm text-muted-foreground">
          Marketing draws on the same workspace budget as the video pipeline.
          Both totals above include it.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MarketingSpendCard
          monthToDateCents={view.monthToDateCents}
          monthlyBudgetCents={view.monthlyBudgetCents}
          byOperation={view.byOperation}
        />
        <MarketingRunTable runs={view.recentRuns} />
      </div>
    </section>
  );
}
