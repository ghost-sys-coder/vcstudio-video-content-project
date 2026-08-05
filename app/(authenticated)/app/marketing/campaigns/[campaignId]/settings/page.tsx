import { notFound } from "next/navigation";
import { MarketingCampaignForm } from "@/components/marketing/MarketingCampaignForm";
import { findMarketingCampaign } from "@/db/repositories/marketing-campaigns.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const campaign = await findMarketingCampaign({
    workspaceId: context.activeMembership.workspaceId,
    campaignId: (await params).campaignId,
  });
  if (!campaign) notFound();
  return <MarketingCampaignForm campaign={campaign} />;
}
