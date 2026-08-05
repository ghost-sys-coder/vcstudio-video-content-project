import { notFound } from "next/navigation";
import { MarketingCampaignTabs } from "@/components/marketing/MarketingCampaignTabs";
import { findMarketingCampaign } from "@/db/repositories/marketing-campaigns.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function MarketingCampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { campaignId } = await params;
  const campaign = await findMarketingCampaign({
    workspaceId: context.activeMembership.workspaceId,
    campaignId,
  });
  if (!campaign) notFound();
  return (
    <div className="space-y-5 p-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {campaign.objective} · {campaign.trafficType}
        </p>
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
      </header>
      <MarketingCampaignTabs campaign={campaign} />
      {children}
    </div>
  );
}
