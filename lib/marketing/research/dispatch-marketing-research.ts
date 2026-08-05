import "server-only";
import { tasks } from "@trigger.dev/sdk";
import type { marketingResearchTask } from "@/trigger/marketing-research";

export async function dispatchMarketingResearch(input: {
  workspaceId: string;
  requestedByUserId: string;
  kind: "company" | "competitor";
  topic: string;
  competitorId?: string;
  requestNonce: string;
}) {
  return tasks.trigger<typeof marketingResearchTask>(
    "marketing-research",
    input,
    {
      idempotencyKey: `marketing-research:${input.workspaceId}:${input.requestNonce}`,
    },
  );
}
