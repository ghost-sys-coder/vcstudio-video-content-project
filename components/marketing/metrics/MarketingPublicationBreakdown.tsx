import type { MarketingQualityMetrics } from "@/lib/marketing/metrics/quality-metrics";

export function MarketingPublicationBreakdown({
  rows,
}: {
  rows: MarketingQualityMetrics["publicationByPlatform"];
}) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">Publication by platform</h2>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Platform</th>
                <th className="pb-2 text-right font-medium">Published</th>
                <th className="pb-2 text-right font-medium">Failed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.platform} className="border-b last:border-0">
                  <td className="py-2 capitalize">{row.platform}</td>
                  <td className="py-2 text-right tabular-nums">
                    {row.published}
                  </td>
                  <td className="py-2 text-right tabular-nums">{row.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No terminal publication attempts belong to this cohort.
        </p>
      )}
    </section>
  );
}
