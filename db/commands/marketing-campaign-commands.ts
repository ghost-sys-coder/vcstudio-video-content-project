import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingCampaigns } from "@/db/schema";
import type { MarketingCampaignInput } from "@/lib/schemas/marketing-campaign";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";

function values(input: MarketingCampaignInput & { createdByUserId?: string }) {
  return {
    name: input.name,
    objective: input.objective,
    trafficType: input.trafficType,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    audienceId: input.audienceId,
    offerId: input.offerId,
    keyMessage: input.keyMessage,
    hypothesis: input.hypothesis,
    platforms: input.platforms,
    briefPlainText: input.briefPlainText,
    briefDocument: plainTextToPortableDocument(input.briefPlainText),
    isBranded: input.isBranded,
    ...(input.createdByUserId
      ? { createdByUserId: input.createdByUserId }
      : {}),
    updatedAt: new Date(),
  };
}

export async function createMarketingCampaign(
  input: MarketingCampaignInput & {
    workspaceId: string;
    createdByUserId: string;
  },
) {
  const [campaign] = await getDatabase()
    .insert(marketingCampaigns)
    .values({ workspaceId: input.workspaceId, ...values(input) })
    .returning();
  if (!campaign) throw new Error("MARKETING_CAMPAIGN_NOT_CREATED");
  return campaign;
}

export async function updateMarketingCampaign(
  input: MarketingCampaignInput & {
    workspaceId: string;
    campaignId: string;
  },
) {
  const [campaign] = await getDatabase()
    .update(marketingCampaigns)
    .set(values(input))
    .where(
      and(
        eq(marketingCampaigns.id, input.campaignId),
        eq(marketingCampaigns.workspaceId, input.workspaceId),
      ),
    )
    .returning();
  if (!campaign) throw new Error("MARKETING_CAMPAIGN_NOT_FOUND");
  return campaign;
}
