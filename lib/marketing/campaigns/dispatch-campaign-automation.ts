import "server-only";
import { tasks } from "@trigger.dev/sdk";
import { updateCampaignAutomationState } from "@/db/commands/marketing-campaign-commands";
import type { marketingCampaignAutomationTask } from "@/trigger/marketing-campaign-automation";

export async function dispatchCampaignAutomation(input: {
  workspaceId: string;
  campaignId: string;
  requestedByUserId: string;
  attempt?: number;
}) {
  const handle = await tasks.trigger<typeof marketingCampaignAutomationTask>(
    "marketing-campaign-automation",
    { ...input, attempt: input.attempt ?? 0 },
    {
      idempotencyKey: `marketing-campaign:${input.campaignId}:v1:${input.attempt ?? 0}`,
    },
  );
  await updateCampaignAutomationState({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    status: "pending",
    triggerRunId: handle.id,
  });
  return handle;
}
