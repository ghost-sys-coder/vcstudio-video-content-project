import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingCampaignDestinations, marketingCampaigns } from "@/db/schema";
import type { MarketingCampaignInput } from "@/lib/schemas/marketing-campaign";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";

type CampaignDestinationSelectionInput = {
  connectionPlatforms: Record<
    string,
    MarketingCampaignInput["platforms"][number]
  >;
};

function values(input: MarketingCampaignInput & { createdByUserId?: string }) {
  return {
    name: input.name,
    brandProfileId: input.brandProfileId,
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

export async function updateCampaignAutomationState(input: {
  workspaceId: string;
  campaignId: string;
  status:
    | "not_started"
    | "pending"
    | "researching"
    | "generating"
    | "completed"
    | "failed";
  triggerRunId?: string;
  error?: string | null;
}) {
  await getDatabase()
    .update(marketingCampaigns)
    .set({
      automationStatus: input.status,
      ...(input.triggerRunId
        ? { automationTriggerRunId: input.triggerRunId }
        : {}),
      automationError: input.error ?? null,
      ...(input.status === "researching"
        ? { automationStartedAt: new Date() }
        : {}),
      ...(input.status === "not_started" || input.status === "pending"
        ? { automationCompletedAt: null }
        : {}),
      ...(["completed", "failed"].includes(input.status)
        ? { automationCompletedAt: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingCampaigns.workspaceId, input.workspaceId),
        eq(marketingCampaigns.id, input.campaignId),
      ),
    );
}

export async function createMarketingCampaign(
  input: MarketingCampaignInput & {
    workspaceId: string;
    createdByUserId: string;
  } & CampaignDestinationSelectionInput,
) {
  const campaignId = randomUUID();
  const database = getDatabase();
  const [campaignRows] = await database.batch([
    database
      .insert(marketingCampaigns)
      .values({
        id: campaignId,
        workspaceId: input.workspaceId,
        ...values(input),
      })
      .returning(),
    database.insert(marketingCampaignDestinations).values(
      input.connectionIds.map((connectionId) => ({
        workspaceId: input.workspaceId,
        campaignId,
        connectionId,
        platform: input.connectionPlatforms[connectionId]!,
      })),
    ),
  ]);
  const campaign = campaignRows[0];
  if (!campaign) throw new Error("MARKETING_CAMPAIGN_NOT_CREATED");
  return campaign;
}

export async function updateMarketingCampaign(
  input: MarketingCampaignInput & {
    workspaceId: string;
    campaignId: string;
  } & CampaignDestinationSelectionInput,
) {
  const database = getDatabase();
  const [campaignRows] = await database.batch([
    database
      .update(marketingCampaigns)
      .set(values(input))
      .where(
        and(
          eq(marketingCampaigns.id, input.campaignId),
          eq(marketingCampaigns.workspaceId, input.workspaceId),
        ),
      )
      .returning(),
    database
      .update(marketingCampaignDestinations)
      .set({ isSelected: false, updatedAt: new Date() })
      .where(
        and(
          eq(marketingCampaignDestinations.workspaceId, input.workspaceId),
          eq(marketingCampaignDestinations.campaignId, input.campaignId),
        ),
      ),
    ...input.connectionIds.map((connectionId) =>
      database
        .insert(marketingCampaignDestinations)
        .values({
          workspaceId: input.workspaceId,
          campaignId: input.campaignId,
          connectionId,
          platform: input.connectionPlatforms[connectionId]!,
          isSelected: true,
        })
        .onConflictDoUpdate({
          target: [
            marketingCampaignDestinations.campaignId,
            marketingCampaignDestinations.connectionId,
          ],
          set: { isSelected: true, updatedAt: new Date() },
        }),
    ),
  ]);
  const campaign = campaignRows[0];
  if (!campaign) throw new Error("MARKETING_CAMPAIGN_NOT_FOUND");
  return campaign;
}
