import { CheckCircle2 } from "lucide-react";
import { acknowledgeMarketingWeeklyDigestAction } from "@/app/(authenticated)/app/marketing/digests/actions";
import type { MarketingWeeklyDigestSnapshot } from "@/lib/marketing/digests/weekly-digest";
import { Button } from "@/components/ui/button";

export function MarketingWeeklyDigestCard({
  id,
  weekStart,
  weekEnd,
  snapshot,
  acknowledged,
}: {
  id: string;
  weekStart: string;
  weekEnd: string;
  snapshot: MarketingWeeklyDigestSnapshot;
  acknowledged: boolean;
}) {
  return (
    <article className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Weekly digest
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {weekStart} to {weekEnd}
          </h2>
        </div>
        {acknowledged ? (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" /> Acknowledged
          </span>
        ) : (
          <form action={acknowledgeMarketingWeeklyDigestAction}>
            <input type="hidden" name="digestId" value={id} />
            <Button type="submit" size="sm">
              Acknowledge
            </Button>
          </form>
        )}
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Generated", snapshot.activity.generated],
          ["Reviewed", snapshot.activity.reviewed],
          ["Approved", snapshot.activity.approved],
          ["Published", snapshot.activity.published],
          ["Spend", `$${(snapshot.spend.actualCostCents / 100).toFixed(2)}`],
          ["Upcoming", snapshot.upcoming.scheduledContent],
        ].map(([label, value]) => (
          <div className="rounded-lg bg-muted/60 p-3" key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="font-medium">Operations</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {snapshot.scheduler.skipped} scheduler skip(s),{" "}
            {snapshot.scheduler.failed} failure(s),{" "}
            {snapshot.spend.budgetRefusals + snapshot.spend.capRefusals} budget
            or cap refusal(s).
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {snapshot.integrations.connectedChannels} connected channel(s),{" "}
            {snapshot.integrations.unhealthyChannels} unhealthy. Google
            Business: {snapshot.integrations.googleBusinessStatus}.
          </p>
        </section>
        <section>
          <h3 className="font-medium">Recommended human actions</h3>
          {snapshot.recommendedActions.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {snapshot.recommendedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No immediate action is recommended.
            </p>
          )}
        </section>
      </div>
    </article>
  );
}
