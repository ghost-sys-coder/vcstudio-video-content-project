import type { MarketingChatToolCall } from "@/db/schema";

export function hasRunningMarketingWork(
  toolCalls: readonly Pick<MarketingChatToolCall, "status">[],
): boolean {
  return toolCalls.some(
    (toolCall) =>
      toolCall.status === "pending" || toolCall.status === "running",
  );
}
