import "server-only";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { marketingChatToolCalls } from "@/db/schema";

export async function beginMarketingToolCall(input: {
  workspaceId: string;
  threadId: string;
  messageId: string;
  toolCallId: string;
  skillKey: string;
  toolInput: Record<string, unknown>;
  estimatedCostCents: number;
}) {
  const [row] = await getDatabase()
    .insert(marketingChatToolCalls)
    .values({
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      messageId: input.messageId,
      toolCallId: input.toolCallId,
      skillKey: input.skillKey,
      input: input.toolInput,
      status: "running",
      estimatedCostCents: input.estimatedCostCents,
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const [existing] = await getDatabase()
    .select()
    .from(marketingChatToolCalls)
    .where(
      and(
        eq(marketingChatToolCalls.threadId, input.threadId),
        eq(marketingChatToolCalls.toolCallId, input.toolCallId),
        eq(marketingChatToolCalls.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("MARKETING_TOOL_CALL_NOT_CREATED");
  return existing;
}

export async function attachMarketingToolCallRun(input: {
  workspaceId: string;
  id: string;
  runId: string;
}): Promise<void> {
  await getDatabase()
    .update(marketingChatToolCalls)
    .set({ runId: input.runId, updatedAt: new Date() })
    .where(
      and(
        eq(marketingChatToolCalls.id, input.id),
        eq(marketingChatToolCalls.workspaceId, input.workspaceId),
      ),
    );
}

export async function completeMarketingToolCall(input: {
  workspaceId: string;
  id: string;
  output: Record<string, unknown>;
  actualCostCents: number;
}): Promise<void> {
  await getDatabase()
    .update(marketingChatToolCalls)
    .set({
      status: "succeeded",
      output: input.output,
      actualCostCents: input.actualCostCents,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingChatToolCalls.id, input.id),
        eq(marketingChatToolCalls.workspaceId, input.workspaceId),
        eq(marketingChatToolCalls.status, "running"),
      ),
    );
}

export async function failMarketingToolCall(input: {
  workspaceId: string;
  id: string;
  category: string;
  message: string;
  actualCostCents: number;
}): Promise<void> {
  await getDatabase()
    .update(marketingChatToolCalls)
    .set({
      status: "failed",
      errorCategory: input.category,
      safeErrorMessage: input.message,
      actualCostCents: input.actualCostCents,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingChatToolCalls.id, input.id),
        eq(marketingChatToolCalls.workspaceId, input.workspaceId),
        eq(marketingChatToolCalls.status, "running"),
      ),
    );
}
