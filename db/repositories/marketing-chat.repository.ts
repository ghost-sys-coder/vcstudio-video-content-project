import "server-only";

import { and, asc, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingChatMessages,
  marketingChatToolCalls,
  marketingChatThreads,
  type MarketingChatMessage,
  type MarketingChatThread,
} from "@/db/schema";

export const MARKETING_THREAD_PAGE_SIZE = 50;

export async function listChatThreads(input: {
  workspaceId: string;
  includeArchived?: boolean;
}): Promise<MarketingChatThread[]> {
  const conditions = [eq(marketingChatThreads.workspaceId, input.workspaceId)];
  if (!input.includeArchived)
    conditions.push(eq(marketingChatThreads.status, "active"));

  return (
    getDatabase()
      .select()
      .from(marketingChatThreads)
      .where(and(...conditions))
      // `lastMessageAt` is null until the first turn lands, so a thread created a
      // moment ago would otherwise sort last. Coalescing to creation time keeps a
      // brand-new thread where the user just put it: at the top.
      .orderBy(
        desc(
          sql`coalesce(${marketingChatThreads.lastMessageAt}, ${marketingChatThreads.createdAt})`,
        ),
      )
      .limit(MARKETING_THREAD_PAGE_SIZE)
  );
}

export async function findMarketingToolCall(input: {
  workspaceId: string;
  toolCallId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(marketingChatToolCalls)
    .where(
      and(
        eq(marketingChatToolCalls.id, input.toolCallId),
        eq(marketingChatToolCalls.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findMarketingToolCallByRun(input: {
  workspaceId: string;
  runId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(marketingChatToolCalls)
    .where(
      and(
        eq(marketingChatToolCalls.workspaceId, input.workspaceId),
        eq(marketingChatToolCalls.runId, input.runId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listMarketingToolCallsForThread(input: {
  workspaceId: string;
  threadId: string;
}) {
  return getDatabase()
    .select()
    .from(marketingChatToolCalls)
    .where(
      and(
        eq(marketingChatToolCalls.workspaceId, input.workspaceId),
        eq(marketingChatToolCalls.threadId, input.threadId),
      ),
    )
    .orderBy(asc(marketingChatToolCalls.createdAt))
    .limit(100);
}

export async function findChatThread(input: {
  workspaceId: string;
  threadId: string;
}): Promise<MarketingChatThread | null> {
  const [thread] = await getDatabase()
    .select()
    .from(marketingChatThreads)
    .where(
      and(
        eq(marketingChatThreads.id, input.threadId),
        eq(marketingChatThreads.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return thread ?? null;
}

/**
 * The most recent `limit` messages of a thread, oldest first.
 *
 * Selects the newest window and reverses it in memory rather than taking the
 * oldest: a long conversation must replay its *recent* turns, and asking the
 * database for the tail is one index scan against
 * `marketing_chat_messages_position_unique`.
 */
export async function listChatMessages(input: {
  workspaceId: string;
  threadId: string;
  limit: number;
}): Promise<MarketingChatMessage[]> {
  const rows = await getDatabase()
    .select()
    .from(marketingChatMessages)
    .where(
      and(
        eq(marketingChatMessages.threadId, input.threadId),
        eq(marketingChatMessages.workspaceId, input.workspaceId),
      ),
    )
    .orderBy(desc(marketingChatMessages.position))
    .limit(input.limit);
  return rows.reverse();
}

/** Messages appended after a known position; the polling endpoint's query. */
export async function listChatMessagesSince(input: {
  workspaceId: string;
  threadId: string;
  sincePosition: number;
  limit: number;
}): Promise<MarketingChatMessage[]> {
  return getDatabase()
    .select()
    .from(marketingChatMessages)
    .where(
      and(
        eq(marketingChatMessages.threadId, input.threadId),
        eq(marketingChatMessages.workspaceId, input.workspaceId),
        gt(marketingChatMessages.position, input.sincePosition),
      ),
    )
    .orderBy(asc(marketingChatMessages.position))
    .limit(input.limit);
}

export async function findChatMessageByNonce(input: {
  workspaceId: string;
  threadId: string;
  requestNonce: string;
}): Promise<MarketingChatMessage | null> {
  const [message] = await getDatabase()
    .select()
    .from(marketingChatMessages)
    .where(
      and(
        eq(marketingChatMessages.threadId, input.threadId),
        eq(marketingChatMessages.workspaceId, input.workspaceId),
        eq(marketingChatMessages.requestNonce, input.requestNonce),
      ),
    )
    .limit(1);
  return message ?? null;
}

/**
 * Messages left `streaming` past a cutoff.
 *
 * A stream that died before its end callback leaves the row here and its
 * reservation pending; the reconciler sweeps both. Scoped by age rather than
 * status alone so a turn that is genuinely still streaming is never touched.
 */
export async function listStalledChatMessages(input: {
  olderThan: Date;
  limit: number;
}): Promise<MarketingChatMessage[]> {
  return getDatabase()
    .select()
    .from(marketingChatMessages)
    .where(
      and(
        eq(marketingChatMessages.status, "streaming"),
        sql`${marketingChatMessages.createdAt} < ${input.olderThan}`,
        isNotNull(marketingChatMessages.runId),
      ),
    )
    .orderBy(asc(marketingChatMessages.createdAt))
    .limit(input.limit);
}
