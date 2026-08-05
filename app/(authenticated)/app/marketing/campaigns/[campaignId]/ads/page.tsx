import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingAdCreativeCard } from "@/components/marketing/MarketingAdCreativeCard";
import { Button } from "@/components/ui/button";
import {
  findMarketingCampaign,
  listMarketingCampaignContent,
} from "@/db/repositories/marketing-campaigns.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function CampaignAdsPage({
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
  const [campaign, items] = await Promise.all([
    findMarketingCampaign(input),
    listMarketingCampaignContent(input),
  ]);
  if (!campaign || campaign.trafficType === "organic") notFound();
  const ads = items.filter((item) => item.kind === "ad_creative");
  return (
    <div className="space-y-4">
      <Button
        nativeButton={false}
        render={
          <Link
            href={`/api/workspaces/${input.workspaceId}/marketing/campaigns/${campaign.id}/ads.csv`}
          />
        }
        variant="outline"
      >
        Export CSV
      </Button>
      {ads.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {ads.map((item) => (
            <MarketingAdCreativeCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No ad variants have been generated for this campaign yet. Start or
          retry automation from the campaign Brief tab.
        </p>
      )}
    </div>
  );
}
