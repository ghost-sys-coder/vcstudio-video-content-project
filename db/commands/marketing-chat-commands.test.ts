import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The insert either returns a row or returns nothing, and "nothing" is
 * ambiguous by design: it means either this nonce is already stored (a retry)
 * or another send took the position (a race). These two knobs let each of those
 * be arranged independently.
 */
const insertOutcome = vi.hoisted(() => ({
  /** How many of the next inserts return no row. */
  emptyInserts: 0,
  rows: [] as Record<string, unknown>[],
}));
const existingByNonce = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
}));

vi.mock("@/db/drizzle", () => ({
  getDatabase: () => ({
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            insertOutcome.rows.push(row);
            if (insertOutcome.emptyInserts > 0) {
              insertOutcome.emptyInserts -= 1;
              return [];
            }
            return [{ id: `id-${insertOutcome.rows.length}`, ...row }];
          },
        }),
      }),
    }),
  }),
}));

vi.mock("@/db/repositories/marketing-chat.repository", () => ({
  findChatMessageByNonce: async () => existingByNonce.row,
}));

import {
  appendUserMessage,
  beginAssistantMessage,
} from "@/db/commands/marketing-chat-commands";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const threadId = "22222222-2222-4222-8222-222222222222";
const requestNonce = "33333333-3333-4333-8333-333333333333";

const message = {
  workspaceId,
  threadId,
  parts: [{ type: "text" as const, text: "Write a launch post." }],
  plainText: "Write a launch post.",
  requestNonce,
};

beforeEach(() => {
  insertOutcome.emptyInserts = 0;
  insertOutcome.rows = [];
  existingByNonce.row = null;
});

describe("appendUserMessage", () => {
  it("accepts a new turn", async () => {
    const result = await appendUserMessage(message);
    expect(result.created).toBe(true);
    expect(insertOutcome.rows).toHaveLength(1);
    expect(insertOutcome.rows[0]?.requestNonce).toBe(requestNonce);
  });

  it("treats a replayed nonce as already accepted", async () => {
    // The ordinary case: a network timeout leaves the browser unsure whether
    // the request landed, and the retry must not append a second copy of the
    // user's message or buy a second answer.
    insertOutcome.emptyInserts = 1;
    existingByNonce.row = { id: "original", requestNonce };

    const result = await appendUserMessage(message);
    expect(result.created).toBe(false);
    expect(result.message.id).toBe("original");
  });

  it("retries when a concurrent send took the position", async () => {
    // Nothing inserted and no row under this nonce means the conflict was on
    // position, not idempotency — the loser simply takes the next one.
    insertOutcome.emptyInserts = 1;
    existingByNonce.row = null;

    const result = await appendUserMessage(message);
    expect(result.created).toBe(true);
    expect(insertOutcome.rows).toHaveLength(2);
  });

  it("gives up rather than looping forever on contention", async () => {
    insertOutcome.emptyInserts = 99;
    await expect(appendUserMessage(message)).rejects.toThrow(
      "MARKETING_CHAT_POSITION_CONTENTION",
    );
  });

  it("computes its position inside the insert rather than reading it first", async () => {
    // Reading max(position) in one statement and inserting in another leaves a
    // window where two concurrent sends pick the same number. The position must
    // therefore arrive as SQL to be evaluated by the database, not as a number
    // this process decided on.
    await appendUserMessage(message);
    expect(typeof insertOutcome.rows[0]?.position).not.toBe("number");
    expect(insertOutcome.rows[0]?.position).toBeTypeOf("object");
  });
});

describe("beginAssistantMessage", () => {
  it("opens the row as streaming before any token arrives", async () => {
    const row = await beginAssistantMessage({
      workspaceId,
      threadId,
      modelId: "test-model",
      promptVersion: "marketing-chat-v1",
      brandContextSnapshotId: null,
      runId: null,
    });
    expect(row.status).toBe("streaming");
    expect(insertOutcome.rows[0]?.role).toBe("assistant");
    // No nonce: only user messages carry one, and the partial unique index
    // depends on that staying true.
    expect(insertOutcome.rows[0]?.requestNonce).toBeNull();
  });
});
