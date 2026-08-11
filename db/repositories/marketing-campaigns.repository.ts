import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingCampaignDestinations,
  marketingCampaigns,
  marketingContentItems,
  platformConnections,
} from "@/db/schema";

export async function listMarketingCampaigns(input: { workspaceId: string }) {
  return getDatabase()
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.workspaceId, input.workspaceId))
    .orderBy(
      desc(marketingCampaigns.startDate),
      desc(marketingCampaigns.createdAt),
    )
    .limit(100);
}

export async function findMarketingCampaign(input: {
  workspaceId: string;
  campaignId: string;
}) {
  const [campaign] = await getDatabase()
    .select()
    .from(marketingCampaigns)
    .where(
      and(
        eq(marketingCampaigns.workspaceId, input.workspaceId),
        eq(marketingCampaigns.id, input.campaignId),
      ),
    )
    .limit(1);
  return campaign ?? null;
}

export async function listMarketingCampaignContent(input: {
  workspaceId: string;
  campaignId: string;
}) {
  return getDatabase()
    .select()
    .from(marketingContentItems)
    .where(
      and(
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.campaignId, input.campaignId),
      ),
    )
    .orderBy(asc(marketingContentItems.createdAt));
}

export async function listMarketingCampaignDestinations(input: {
  workspaceId: string;
  campaignId: string;
  selectedOnly?: boolean;
}) {
  return getDatabase()
    .select({
      destination: marketingCampaignDestinations,
      accountName: platformConnections.externalAccountName,
      accountStatus: platformConnections.status,
    })
    .from(marketingCampaignDestinations)
    .innerJoin(
      platformConnections,
      and(
        eq(platformConnections.id, marketingCampaignDestinations.connectionId),
        eq(
          platformConnections.workspaceId,
          marketingCampaignDestinations.workspaceId,
        ),
      ),
    )
    .where(
      and(
        eq(marketingCampaignDestinations.workspaceId, input.workspaceId),
        eq(marketingCampaignDestinations.campaignId, input.campaignId),
        ...(input.selectedOnly === false
          ? []
          : [eq(marketingCampaignDestinations.isSelected, true)]),
      ),
    )
    .orderBy(
      asc(marketingCampaignDestinations.platform),
      asc(platformConnections.externalAccountName),
    );
}
