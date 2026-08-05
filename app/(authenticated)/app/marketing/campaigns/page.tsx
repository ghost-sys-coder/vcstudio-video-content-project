import { MarketingCampaignCard } from "@/components/marketing/MarketingCampaignCard";
import { MarketingCampaignForm } from "@/components/marketing/MarketingCampaignForm";
import { listMarketingCampaigns } from "@/db/repositories/marketing-campaigns.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { listActiveMarketingCompetitors } from "@/db/repositories/marketing-research.repository";

export default async function MarketingCampaignsPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const workspaceId = context.activeMembership.workspaceId;
  const [campaigns, competitors] = await Promise.all([
    listMarketingCampaigns({ workspaceId }),
    listActiveMarketingCompetitors({ workspaceId }),
  ]);
  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Plan organic and paid work around one measurable objective.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="font-medium">New campaign</h2>
        <MarketingCampaignForm automationReady={competitors.length > 0} />
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Campaign library</h2>
        {campaigns.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <MarketingCampaignCard campaign={campaign} key={campaign.id} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        )}
      </section>
    </div>
  );
}
