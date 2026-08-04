import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { findChatMessageByNonce } from "@/db/repositories/marketing-chat.repository";
import {
  marketingChatMessages,
  marketingChatThreads,
  type MarketingChatMessage,
  type MarketingChatThread,
} from "@/db/schema";
import type { MarketingChatMessagePart } from "@/lib/schemas/marketing-chat-message";

/**
 * How many times a losing insert retries its position.
 *
 * Two sends racing on the same thread is the only cause, and the loser wins on
 * its next attempt. Three is generous for a conversation that has exactly one
 * human typing into it; a persistent failure past that is a bug worth surfacing
 * rather than a race worth grinding on.
 */
const POSITION_RETRY_LIMIT = 3;

export async function createChatThread(input: {
  workspaceId: string;
  createdByUserId: string;
  title: string;
}): Promise<MarketingChatThread> {
  const [thread] = await getDatabase()
    .insert(marketingChatThreads)
    .values({
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
      title: input.title,
    })
    .returning();
  if (!thread) throw new Error("MARKETING_THREAD_NOT_CREATED");
  return thread;
}

export async function renameChatThread(input: {
  workspaceId: string;
  threadId: string;
  title: string;
}): Promise<void> {
  await getDatabase()
    .update(marketingChatThreads)
    .set({ title: input.title, updatedAt: new Date() })
    .where(
      and(
        eq(marketingChatThreads.id, input.threadId),
        eq(marketingChatThreads.workspaceId, input.workspaceId),
      ),
    );
}

export async function setChatThreadStatus(input: {
  workspaceId: string;
  threadId: string;
  status: "active" | "archived";
}): Promise<void> {
  await getDatabase()
    .update(marketingChatThreads)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(
        eq(marketingChatThreads.id, input.threadId),
        eq(marketingChatThreads.workspaceId, input.workspaceId),
      ),
    );
}

type InsertMessageInput = {
  workspaceId: string;
  threadId: string;
  role: "user" | "assistant";
  parts: MarketingChatMessagePart[];
  plainText: string;
  requestNonce?: string | null;
  status?: "streaming" | "complete" | "failed";
  modelId?: string;
  promptVersion?: string;
  brandContextSnapshotId?: string | null;
  runId?: string | null;
};

/**
 * Appends a message at `max(position) + 1`, computed inside the insert.
 *
 * Reading the maximum in one statement and inserting in another leaves a window
 * where a concurrent send picks the same number; computing it in the `values`
 * clause closes most of that window, and the unique index closes the rest by
 * rejecting the loser outright. `onConflictDoNothing` with no target is
 * deliberate — this statement can violate either the position index or the
 * nonce index, and the caller needs to tell those apart by what it finds
 * afterwards, not by which constraint name came back in an error string.
 */
async function insertChatMessage(
  input: InsertMessageInput,
): Promise<MarketingChatMessage | null> {
  const [message] = await getDatabase()
    .insert(marketingChatMessages)
    .values({
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      role: input.role,
      parts: input.parts,
      plainText: input.plainText,
      position: sql`(select coalesce(max(inner_messages.position), -1) + 1 from ${marketingChatMessages} as inner_messages where inner_messages.thread_id = ${input.threadId})`,
      requestNonce: input.requestNonce ?? null,
      status: input.status ?? "complete",
      modelId: input.modelId ?? "",
      promptVersion: input.promptVersion ?? "",
      brandContextSnapshotId: input.brandContextSnapshotId ?? null,
      runId: input.runId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return message ?? null;
}

export type AppendUserMessageResult = {
  message: MarketingChatMessage;
  /** False when this nonce had already been accepted — a retry, not a new turn. */
  created: boolean;
};

/**
 * Accepts a user turn exactly once.
 *
 * The nonce is what makes a retried send idempotent. A network timeout that
 * leaves the browser unsure whether the request landed is the ordinary case,
 * and without this the user's retry appends a second copy of their message and
 * pays for a second answer.
 */
export async function appendUserMessage(input: {
  workspaceId: string;
  threadId: string;
  parts: MarketingChatMessagePart[];
  plainText: string;
  requestNonce: string;
}): Promise<AppendUserMessageResult> {
  for (let attempt = 0; attempt < POSITION_RETRY_LIMIT; attempt += 1) {
    const inserted = await insertChatMessage({
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      role: "user",
      parts: input.parts,
      plainText: input.plainText,
      requestNonce: input.requestNonce,
      status: "complete",
    });
    if (inserted) return { message: inserted, created: true };

    // Nothing inserted: either this nonce is already here (a retry) or another
    // send took the position (a race). Only the first is visible by lookup.
    const existing = await findChatMessageByNonce({
      workspaceId: input.workspaceId,
      threadId: input.threadId,
      requestNonce: input.requestNonce,
    });
    if (existing) return { message: existing, created: false };
  }
  throw new Error("MARKETING_CHAT_POSITION_CONTENTION");
}

/**
 * Opens the assistant row before the first token.
 *
 * Written up front rather than at the end so a stream that dies mid-flight
 * leaves evidence. A row stuck `streaming` is what the reconciler looks for; no
 * row at all would be indistinguishable from a turn that never started, and the
 * reservation would sit pending with nothing pointing at it.
 */
export async function beginAssistantMessage(input: {
  workspaceId: string;
  threadId: string;
  modelId: string;
  promptVersion: string;
  brandContextSnapshotId: string | null;
  runId: string | null;
}): Promise<MarketingChatMessage> {
  for (let attempt = 0; attempt < POSITION_RETRY_LIMIT; attempt += 1) {
    const inserted = await insertChatMessage({
      ...input,
      role: "assistant",
      parts: [],
      plainText: "",
      status: "streaming",
    });
    if (inserted) return inserted;
  }
  throw new Error("MARKETING_CHAT_POSITION_CONTENTION");
}

/**
 * Settles a finished assistant turn and rolls the thread totals forward.
 *
 * Message and thread move in one batch: Neon's HTTP driver has no interactive
 * transactions, and a thread whose `total_cost_cents` disagrees with the sum of
 * its messages is a ledger the user cannot trust.
 *
 * The message count is recomputed from the rows rather than incremented,
 * because an increment applied twice by a retried settle would drift, and this
 * value is only ever read for display.
 */
export async function completeAssistantMessage(input: {
  workspaceId: string;
  messageId: string;
  threadId: string;
  parts: MarketingChatMessagePart[];
  plainText: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  finishReason: string;
  providerRequestId: string | null;
}): Promise<void> {
  const database = getDatabase();
  const now = new Date();

  await database.batch([
    database
      .update(marketingChatMessages)
      .set({
        parts: input.parts,
        plainText: input.plainText,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costCents: input.costCents,
        status: "complete",
        finishReason: input.finishReason,
        providerRequestId: input.providerRequestId,
        updatedAt: now,
      })
      .where(
        and(
          eq(marketingChatMessages.id, input.messageId),
          eq(marketingChatMessages.workspaceId, input.workspaceId),
          // Only a still-streaming row settles. A second settle — a retried
          // callback, a reconciler racing the stream — finds nothing to do
          // instead of adding this turn's cost to the thread a second time.
          eq(marketingChatMessages.status, "streaming"),
        ),
      ),
    database
      .update(marketingChatThreads)
      .set({
        lastMessageAt: now,
        updatedAt: now,
        messageCount: sql`(select count(*) from ${marketingChatMessages} where thread_id = ${input.threadId})`,
        totalCostCents: sql`(select coalesce(sum(cost_cents), 0) from ${marketingChatMessages} where thread_id = ${input.threadId})`,
      })
      .where(
        and(
          eq(marketingChatThreads.id, input.threadId),
          eq(marketingChatThreads.workspaceId, input.workspaceId),
        ),
      ),
  ]);
}

/**
 * Records an honest failure on the assistant row.
 *
 * `costCents` is not always zero. When the provider streamed tokens before the
 * failure it billed for them, and recording zero would understate real spend —
 * the same rule the rest of the ledger follows.
 */
export async function failAssistantMessage(input: {
  workspaceId: string;
  messageId: string;
  threadId: string;
  safeErrorMessage: string;
  costCents: number;
  parts?: MarketingChatMessagePart[];
  plainText?: string;
}): Promise<void> {
  const database = getDatabase();
  const now = new Date();

  await database.batch([
    database
      .update(marketingChatMessages)
      .set({
        status: "failed",
        safeErrorMessage: input.safeErrorMessage,
        costCents: input.costCents,
        parts: input.parts ?? [],
        plainText: input.plainText ?? "",
        updatedAt: now,
      })
      .where(
        and(
          eq(marketingChatMessages.id, input.messageId),
          eq(marketingChatMessages.workspaceId, input.workspaceId),
          eq(marketingChatMessages.status, "streaming"),
        ),
      ),
    database
      .update(marketingChatThreads)
      .set({
        lastMessageAt: now,
        updatedAt: now,
        messageCount: sql`(select count(*) from ${marketingChatMessages} where thread_id = ${input.threadId})`,
        totalCostCents: sql`(select coalesce(sum(cost_cents), 0) from ${marketingChatMessages} where thread_id = ${input.threadId})`,
      })
      .where(
        and(
          eq(marketingChatThreads.id, input.threadId),
          eq(marketingChatThreads.workspaceId, input.workspaceId),
        ),
      ),
  ]);
}
