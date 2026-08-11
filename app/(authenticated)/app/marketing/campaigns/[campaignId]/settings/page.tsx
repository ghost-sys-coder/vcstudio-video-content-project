import { notFound } from "next/navigation";
import { MarketingCampaignForm } from "@/components/marketing/MarketingCampaignForm";
import {
  findMarketingCampaign,
  listMarketingCampaignDestinations,
} from "@/db/repositories/marketing-campaigns.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { findBrandProfile } from "@/db/repositories/marketing-brand.repository";
import { listPlatformConnections } from "@/db/repositories/publishing.repository";

export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const workspaceId = context.activeMembership.workspaceId;
  const campaignId = (await params).campaignId;
  const [campaign, brandProfile, connections, destinations] = await Promise.all(
    [
      findMarketingCampaign({ workspaceId, campaignId }),
      findBrandProfile({ workspaceId }),
      listPlatformConnections({ workspaceId }),
      listMarketingCampaignDestinations({ workspaceId, campaignId }),
    ],
  );
  if (!campaign) notFound();
  return (
    <MarketingCampaignForm
      brandProfile={brandProfile}
      campaign={campaign}
      connections={connections}
      selectedConnectionIds={destinations.map(
        ({ destination }) => destination.connectionId,
      )}
    />
  );
}
