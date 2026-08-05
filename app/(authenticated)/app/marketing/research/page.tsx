import { MarketingCompetitorCard } from "@/components/marketing/MarketingCompetitorCard";
import { MarketingCompetitorForm } from "@/components/marketing/MarketingCompetitorForm";
import { ResearchSnapshotCard } from "@/components/marketing/ResearchSnapshotCard";
import { CompanyResearchForm } from "@/components/marketing/CompanyResearchForm";
import { ResearchRequestPoller } from "@/components/marketing/ResearchRequestPoller";
import {
  getMarketingResearchCurrentTime,
  listActiveMarketingCompetitors,
  listMarketingResearchSnapshots,
} from "@/db/repositories/marketing-research.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { findBrandProfile } from "@/db/repositories/marketing-brand.repository";

export default async function MarketingResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ researchQueued?: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const workspaceId = context.activeMembership.workspaceId;
  const [competitors, snapshots, now, profile] = await Promise.all([
    listActiveMarketingCompetitors({ workspaceId }),
    listMarketingResearchSnapshots({ workspaceId }),
    getMarketingResearchCurrentTime(),
    findBrandProfile({ workspaceId }),
  ]);
  const queued = (await searchParams).researchQueued === "1";
  const active = snapshots.some((snapshot) =>
    ["pending", "running"].includes(snapshot.status),
  );
  return (
    <div className="space-y-8 p-6">
      {queued || active ? <ResearchRequestPoller /> : null}
      <header>
        <h1 className="text-2xl font-semibold">Research</h1>
        <p className="text-sm text-muted-foreground">
          Current, cited competitor and trend evidence used before campaign
          generation.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="font-medium">Company research</h2>
        <CompanyResearchForm businessName={profile?.businessName ?? ""} />
        {queued ? (
          <p className="text-sm text-muted-foreground">
            Research was queued. This page refreshes while results are prepared.
          </p>
        ) : null}
      </section>
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
