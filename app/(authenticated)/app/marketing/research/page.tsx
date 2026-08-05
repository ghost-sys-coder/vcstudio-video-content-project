import { MarketingCompetitorCard } from "@/components/marketing/MarketingCompetitorCard";
import { MarketingCompetitorForm } from "@/components/marketing/MarketingCompetitorForm";
import { ResearchSnapshotCard } from "@/components/marketing/ResearchSnapshotCard";
import {
  getMarketingResearchCurrentTime,
  listActiveMarketingCompetitors,
  listMarketingResearchSnapshots,
} from "@/db/repositories/marketing-research.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function MarketingResearchPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const workspaceId = context.activeMembership.workspaceId;
  const [competitors, snapshots, now] = await Promise.all([
    listActiveMarketingCompetitors({ workspaceId }),
    listMarketingResearchSnapshots({ workspaceId }),
    getMarketingResearchCurrentTime(),
  ]);
  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Research</h1>
        <p className="text-sm text-muted-foreground">
          Current, cited competitor and trend evidence used before campaign
          generation.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="font-medium">Add a known competitor</h2>
        <MarketingCompetitorForm />
        <div className="grid gap-3 lg:grid-cols-2">
          {competitors.map((competitor) => (
            <MarketingCompetitorCard
              competitor={competitor}
              key={competitor.id}
            />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Research snapshots</h2>
        {snapshots.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {snapshots.map((snapshot) => (
              <ResearchSnapshotCard
                key={snapshot.id}
                snapshot={snapshot}
                stale={snapshot.expiresAt.getTime() <= now.getTime()}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No research has run yet. Add competitors, then create a campaign.
          </p>
        )}
      </section>
    </div>
  );
}
