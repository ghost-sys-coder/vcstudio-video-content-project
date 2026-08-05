import "server-only";
import { tasks } from "@trigger.dev/sdk";
import {
  attachMarketingToolCallTriggerRun,
  beginMarketingToolCall,
  failMarketingToolCall,
} from "@/db/commands/marketing-chat-tool-call-commands";
import { requireCapability } from "@/lib/policies/workspace-policy";
import type {
  MarketingSkillDefinition,
  SkillExecutionContext,
} from "@/lib/marketing/skills/skill-definition";
import type { marketingVideoDraftTask } from "@/trigger/marketing-video-draft";

export async function executeVideoDraftSkill(input: {
  definition: MarketingSkillDefinition;
  values: Record<string, string | number>;
  toolCallId: string;
  context: SkillExecutionContext;
}) {
  requireCapability(input.context.role, input.definition.capability);
  const row = await beginMarketingToolCall({
    workspaceId: input.context.workspaceId,
    threadId: input.context.threadId,
    messageId: input.context.messageId,
    toolCallId: input.toolCallId,
    skillKey: input.definition.key,
    toolInput: input.values,
    estimatedCostCents: 0,
    status: "pending",
  });
  if (row.triggerRunId || row.status === "succeeded")
    return { status: "started" as const, toolCallId: row.id };
  try {
    const handle = await tasks.trigger<typeof marketingVideoDraftTask>(
      "marketing-video-draft",
      {
        workspaceId: input.context.workspaceId,
        userId: input.context.userId,
        toolCallId: row.id,
      },
    );
    await attachMarketingToolCallTriggerRun({
      workspaceId: input.context.workspaceId,
      id: row.id,
      triggerRunId: handle.id,
    });
    return { status: "started" as const, toolCallId: row.id };
  } catch (error) {
    await failMarketingToolCall({
      workspaceId: input.context.workspaceId,
      id: row.id,
      category: "dispatch_failed",
      message: "The video draft could not be queued. Try again.",
      actualCostCents: 0,
    });
    throw error;
  }
}
