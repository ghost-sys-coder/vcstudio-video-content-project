import { redirect } from "next/navigation";
import { MarketingMetricsDashboard } from "@/components/marketing/metrics/MarketingMetricsDashboard";
import { loadMarketingQualityComparison } from "@/db/repositories/marketing-quality-metrics.repository";
import { loadPerformanceDashboard } from "@/db/repositories/publication-performance.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { parseMarketingMetricsRange } from "@/lib/schemas/marketing-metrics";

export default async function MarketingMetricsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  const params = await searchParams;
  const range = parseMarketingMetricsRange(
    Array.isArray(params.range) ? params.range[0] : params.range,
  );
  const workspaceId = context.activeMembership.workspaceId;
  const [comparison, performance] = await Promise.all([
    loadMarketingQualityComparison({
      workspaceId,
      current: { from: range.from, to: range.to },
      previous: { from: range.previousFrom, to: range.previousTo },
    }),
    loadPerformanceDashboard({ workspaceId }),
  ]);
  return (
    <MarketingMetricsDashboard
      days={range.days}
      {...comparison}
      performance={performance}
    />
  );
}
