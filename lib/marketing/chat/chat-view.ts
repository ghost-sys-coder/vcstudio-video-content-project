import "server-only";

import { safeValidateUIMessages, type UIMessage } from "ai";
import { findBrandProfile } from "@/db/repositories/marketing-brand.repository";
import {
  findChatThread,
  listChatMessages,
  listChatThreads,
  listMarketingToolCallsForThread,
} from "@/db/repositories/marketing-chat.repository";
import type { ChatThreadRowData } from "@/components/marketing/ChatThreadRow";
import { getMarketingEnvironment } from "@/lib/env/server";
import { hasRunningMarketingWork } from "@/lib/marketing/chat/tool-call-status";

export async function loadChatThreadRows(input: {
  workspaceId: string;
}): Promise<ChatThreadRowData[]> {
  const threads = await listChatThreads({ workspaceId: input.workspaceId });
  return threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    messageCount: thread.messageCount,
    totalCostCents: thread.totalCostCents,
  }));
}

export type ChatThreadView = {
  threadId: string;
  title: string;
  messageCount: number;
  totalCostCents: number;
  messages: UIMessage[];
  hasBrandProfile: boolean;
  lastPosition: number;
  hasRunningWork: boolean;
};

/**
 * Everything one thread page needs, in one place.
 *
 * A message still `streaming` is excluded. It is the row an interrupted turn
 * left behind, and rendering it would show an empty assistant bubble that never
 * fills in — the page would look broken rather than look like a turn that
 * failed. Failed rows are excluded for the same reason: the transcript should
 * not carry turns the model never actually produced.
 */
export async function loadChatThreadView(input: {
  workspaceId: string;
  threadId: string;
}): Promise<ChatThreadView | null> {
  const thread = await findChatThread(input);
  if (!thread) return null;

  const [rows, profile, toolCalls] = await Promise.all([
    listChatMessages({
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      limit: getMarketingEnvironment().MARKETING_CHAT_HISTORY_MESSAGES,
    }),
    findBrandProfile({ workspaceId: input.workspaceId }),
    listMarketingToolCallsForThread(input),
  ]);

  // Validated by the SDK rather than asserted into shape. These rows were
  // written by an earlier version of the same dependency and are the input to
  // its renderer; a cast here would move a real failure from this line to a
  // crash inside a client component.
  const validated = await safeValidateUIMessages({
    messages: rows
      .filter((row) => row.status === "complete" && row.parts.length > 0)
      .map((row) => ({ id: row.id, role: row.role, parts: row.parts })),
  });

  return {
    threadId: thread.id,
    title: thread.title,
    messageCount: thread.messageCount,
    totalCostCents: thread.totalCostCents,
    messages: validated.success ? validated.data : [],
    hasBrandProfile: profile !== null,
    lastPosition: rows.at(-1)?.position ?? -1,
    hasRunningWork: hasRunningMarketingWork(toolCalls),
  };
}
