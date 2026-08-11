"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMarketingCampaign,
  updateCampaignAutomationState,
  updateMarketingCampaign,
} from "@/db/commands/marketing-campaign-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { marketingCampaignMutationSchema } from "@/lib/schemas/marketing-campaign";
import { dispatchCampaignAutomation } from "@/lib/marketing/campaigns/dispatch-campaign-automation";
import { findMarketingCampaign } from "@/db/repositories/marketing-campaigns.repository";
import { canStartCampaignAutomation } from "@/lib/marketing/campaigns/campaign-automation-presentation";
import { approveAllCampaignContent } from "@/db/commands/marketing-content-commands";
import { findBrandProfile } from "@/db/repositories/marketing-brand.repository";
import { listPlatformConnections } from "@/db/repositories/publishing.repository";

function parse(formData: FormData) {
  return marketingCampaignMutationSchema.safeParse({
    ...Object.fromEntries(formData),
    platforms: formData.getAll("platforms"),
    connectionIds: formData.getAll("connectionIds"),
    trafficType: "organic",
    isBranded: formData.get("isBranded") === "on",
  });
}

async function context() {
  const value = await getAuthenticatedWorkspaceContext();
  if (!value) throw new Error("MARKETING_CAMPAIGN_CONTEXT_UNAVAILABLE");
  requireCapability(value.activeMembership.role, "approveMarketingContent");
  return value;
}

export async function saveMarketingCampaignAction(formData: FormData) {
  const parsed = parse(formData);
  if (!parsed.success) throw new Error("Invalid campaign details.");
  if (
    !parsed.data.campaignId &&
    formData.get("confirmAutomationSpend") !== "on"
  )
    throw new Error("Confirm automatic campaign generation before creating.");
  const auth = await context();
  const workspaceId = auth.activeMembership.workspaceId;
  const [brandProfile, connections] = await Promise.all([
    findBrandProfile({ workspaceId }),
    listPlatformConnections({ workspaceId }),
  ]);
  if (!brandProfile || brandProfile.id !== parsed.data.brandProfileId)
    throw new Error("Select this workspace's business profile.");
  const selectedConnections = connections.filter((connection) =>
    parsed.data.connectionIds.includes(connection.id),
  );
  if (
    selectedConnections.length !== parsed.data.connectionIds.length ||
    selectedConnections.some(
      (connection) =>
        connection.status !== "active" ||
        !parsed.data.platforms.includes(connection.platform),
    ) ||
    parsed.data.platforms.some(
      (platform) =>
        !selectedConnections.some(
          (connection) => connection.platform === platform,
        ),
    )
  )
    throw new Error(
      "Select at least one active account for every campaign platform.",
    );
  const connectionPlatforms = Object.fromEntries(
    selectedConnections.map((connection) => [
      connection.id,
      connection.platform,
    ]),
  );
  const campaign = parsed.data.campaignId
    ? await updateMarketingCampaign({
        ...parsed.data,
        campaignId: parsed.data.campaignId,
        workspaceId,
        connectionPlatforms,
      })
    : await createMarketingCampaign({
        ...parsed.data,
        workspaceId,
        createdByUserId: auth.user.id,
        connectionPlatforms,
      });
  if (!parsed.data.campaignId)
    try {
      await dispatchCampaignAutomation({
        workspaceId,
        campaignId: campaign.id,
        requestedByUserId: auth.user.id,
      });
    } catch {
      await updateCampaignAutomationState({
        workspaceId,
        campaignId: campaign.id,
        status: "failed",
        error: "Campaign automation could not be queued. Try again.",
      });
    }
  revalidatePath("/app/marketing/campaigns");
  redirect(`/app/marketing/campaigns/${campaign.id}`);
}

export async function startCampaignAutomationAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const auth = await context();
  const workspaceId = auth.activeMembership.workspaceId;
  const campaign = await findMarketingCampaign({ workspaceId, campaignId });
  if (
    !campaign ||
    !canStartCampaignAutomation({
      status: campaign.automationStatus,
      completedAt: campaign.automationCompletedAt,
    })
  )
    throw new Error("Campaign automation cannot be started.");
  await updateCampaignAutomationState({
    workspaceId,
    campaignId,
    status: "pending",
    error: null,
  });
  await dispatchCampaignAutomation({
    workspaceId,
    campaignId,
    requestedByUserId: auth.user.id,
    attempt: Date.now(),
  });
  revalidatePath(`/app/marketing/campaigns/${campaignId}`);
}

export const retryCampaignAutomationAction = startCampaignAutomationAction;

export async function approveAllCampaignContentAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const auth = await context();
  const workspaceId = auth.activeMembership.workspaceId;
  const campaign = await findMarketingCampaign({ workspaceId, campaignId });
  if (!campaign) throw new Error("Campaign not found.");
  await approveAllCampaignContent({
    workspaceId,
    campaignId,
    reviewedByUserId: auth.user.id,
  });
  revalidatePath(`/app/marketing/campaigns/${campaignId}/content`);
}
