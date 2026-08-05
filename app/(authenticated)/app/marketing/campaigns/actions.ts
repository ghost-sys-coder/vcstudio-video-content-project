"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMarketingCampaign,
  updateMarketingCampaign,
} from "@/db/commands/marketing-campaign-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { marketingCampaignMutationSchema } from "@/lib/schemas/marketing-campaign";

function parse(formData: FormData) {
  return marketingCampaignMutationSchema.safeParse({
    ...Object.fromEntries(formData),
    platforms: formData.getAll("platforms"),
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
  const auth = await context();
  const workspaceId = auth.activeMembership.workspaceId;
  const campaign = parsed.data.campaignId
    ? await updateMarketingCampaign({
        ...parsed.data,
        campaignId: parsed.data.campaignId,
        workspaceId,
      })
    : await createMarketingCampaign({
        ...parsed.data,
        workspaceId,
        createdByUserId: auth.user.id,
      });
  revalidatePath("/app/marketing/campaigns");
  redirect(`/app/marketing/campaigns/${campaign.id}`);
}
