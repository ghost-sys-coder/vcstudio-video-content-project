import { describe, expect, it, vi } from "vitest";
import { asSchema } from "ai";

vi.mock("server-only", () => ({}));

const searched = vi.hoisted(() => ({
  calls: [] as { workspaceId: string; query: string; limit: number }[],
  hits: [] as {
    documentId: string;
    title: string;
    passage: string;
    rank: number;
  }[],
}));

vi.mock("@/db/repositories/marketing-documents.repository", () => ({
  searchKnowledgeDocuments: async (input: {
    workspaceId: string;
    query: string;
    limit: number;
  }) => {
    searched.calls.push(input);
    return searched.hits;
  },
}));

import {
  BILLABLE_CHAT_TOOL_NAMES,
  buildChatTools,
  CHAT_TOOL_DESCRIPTIONS,
  CHAT_TOOL_NAMES,
} from "@/lib/marketing/chat/build-chat-tools";
import { SEARCH_BRAND_KNOWLEDGE_TOOL_NAME } from "@/lib/marketing/chat/search-brand-knowledge";

const workspaceId = "11111111-1111-4111-8111-111111111111";

describe("buildChatTools", () => {
  it("serialises a NON-EMPTY input schema", async () => {
    // The documented Zod 4 x AI SDK risk, and the reason it is asserted rather
    // than assumed: a version mismatch produces an empty schema silently, so
    // the model would see a tool it cannot call correctly and nothing would
    // error. This test fails loudly on the day the pairing breaks.
    const tools = buildChatTools({ workspaceId });
    const inputSchema = tools[SEARCH_BRAND_KNOWLEDGE_TOOL_NAME]?.inputSchema;
    expect(inputSchema).toBeDefined();

    // `jsonSchema` may be lazy, which is why it is awaited rather than read.
    const jsonSchema = await asSchema(inputSchema!).jsonSchema;
    expect(jsonSchema.type).toBe("object");
    expect(Object.keys(jsonSchema.properties ?? {})).toContain("query");
    expect(jsonSchema.required).toContain("query");
  });

  it("scopes the search to the workspace it was built for", async () => {
    // The model chooses the query. It does not choose the corpus — there is no
    // parameter for one, and this asserts the closure actually supplies it.
    searched.calls = [];
    searched.hits = [];
    const tools = buildChatTools({ workspaceId });
    const execute = tools[SEARCH_BRAND_KNOWLEDGE_TOOL_NAME]?.execute;
    expect(execute).toBeDefined();

    await execute!(
      { query: "pricing" },
      { toolCallId: "call-1", messages: [], context: undefined },
    );

    expect(searched.calls).toHaveLength(1);
    expect(searched.calls[0]?.workspaceId).toBe(workspaceId);
    expect(searched.calls[0]?.query).toBe("pricing");
  });

  it("describes every tool it offers", () => {
    // The system prompt is rendered from these, so a missing description would
    // hand the model a capability line ending in nothing.
    for (const name of CHAT_TOOL_NAMES)
      expect(CHAT_TOOL_DESCRIPTIONS[name]).toBeTruthy();
  });

  it("names only tools that exist", () => {
    const tools = buildChatTools({ workspaceId });
    for (const name of CHAT_TOOL_NAMES) expect(tools[name]).toBeDefined();
    for (const name of BILLABLE_CHAT_TOOL_NAMES)
      expect(CHAT_TOOL_NAMES).toContain(name);
  });

  it("has no billable tool in this slice", () => {
    // Recorded as an assertion rather than a comment: adding a billable tool
    // without registering it here would silently exempt it from the per-turn
    // cost ceiling.
    expect(BILLABLE_CHAT_TOOL_NAMES).toEqual([]);
  });
});
