import { MarketingWeeklyDigestCard } from "@/components/marketing/digests/MarketingWeeklyDigestCard";
import type { MarketingWeeklyDigestSnapshot } from "@/lib/marketing/digests/weekly-digest";

export function MarketingWeeklyDigestList({
  digests,
}: {
  digests: {
    id: string;
    weekStart: string;
    weekEnd: string;
    snapshot: MarketingWeeklyDigestSnapshot;
    acknowledged: boolean;
  }[];
}) {
  return (
    <div className="app-page">
      <header className="app-heading">
        <p className="text-sm font-medium text-primary">Marketing Studio</p>
        <h1 className="text-2xl font-semibold">Weekly digests</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          A factual weekly record of content quality, spend controls, scheduler
          outcomes, integration health, and work requiring human attention.
        </p>
      </header>
      <div className="app-section">
        {digests.length ? (
          digests.map((digest) => (
            <MarketingWeeklyDigestCard key={digest.id} {...digest} />
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            The first digest appears after the Monday 06:00 UTC reporting run.
          </div>
        )}
      </div>
    </div>
  );
}
