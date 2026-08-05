import { notFound } from "next/navigation";
import { MarketingContentQueue } from "@/components/marketing/MarketingContentQueue";
import {
  findMarketingCampaign,
  listMarketingCampaignContent,
} from "@/db/repositories/marketing-campaigns.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMarketingContentMediaViews } from "@/lib/marketing/content/marketing-content-media-view";

export default async function CampaignContentPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const input = {
    workspaceId: context.activeMembership.workspaceId,
    campaignId: (await params).campaignId,
  };
  const [campaign, allItems] = await Promise.all([
    findMarketingCampaign(input),
    listMarketingCampaignContent(input),
  ]);
  if (!campaign || campaign.trafficType === "paid") notFound();
  const items = allItems.filter((item) => item.kind !== "ad_creative");
  const mediaByContentItemId = await loadMarketingContentMediaViews({
    workspaceId: input.workspaceId,
    contentItemIds: items.map((item) => item.id),
  });
  return (
    <MarketingContentQueue
      emptyMessage="No content has been generated for this campaign yet. Start or retry automation from the campaign Brief tab."
      items={items}
      mediaByContentItemId={mediaByContentItemId}
    />
  );
}
