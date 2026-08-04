import "server-only";

import { tool, type ToolSet } from "ai";
import {
  searchBrandKnowledge,
  searchBrandKnowledgeInputSchema,
  SEARCH_BRAND_KNOWLEDGE_TOOL_NAME,
} from "@/lib/marketing/chat/search-brand-knowledge";

/**
 * Tools that cost money, listed by name.
 *
 * Empty in this slice — searching is a database query. It exists now rather
 * than with the first billable tool because `prepareStep` reads it, and the
 * ceiling that drops billable tools must be wired and tested before there is
 * anything for it to drop. A cost ceiling first exercised on the day it is
 * first needed is a cost ceiling nobody has ever seen work.
 */
export const BILLABLE_CHAT_TOOL_NAMES: readonly string[] = [];

/** Every tool name this deployment can offer, in a stable order. */
export const CHAT_TOOL_NAMES = [SEARCH_BRAND_KNOWLEDGE_TOOL_NAME] as const;

/**
 * Human-readable capability lines for the system prompt.
 *
 * Derived from the same list the model is actually given, so the prompt cannot
 * promise a capability that is not wired up — the failure mode where a model
 * confidently offers to schedule a post it has no way to schedule.
 */
export const CHAT_TOOL_DESCRIPTIONS: Record<string, string> = {
  [SEARCH_BRAND_KNOWLEDGE_TOOL_NAME]:
    "Search the documents this business has uploaded, and quote what they say.",
};

/**
 * Builds the tool set for one turn.
 *
 * `workspaceId` is closed over rather than accepted as a tool argument. A model
 * cannot pass a workspace it should not read, because there is no parameter for
 * one — the scope is fixed by the request that already proved membership. This
 * is the same rule the server actions follow, and it is the reason a tool
 * definition lives here rather than being assembled from client input.
 */
export function buildChatTools(input: { workspaceId: string }): ToolSet {
  return {
    [SEARCH_BRAND_KNOWLEDGE_TOOL_NAME]: tool({
      description:
        "Search this business's uploaded documents for a fact, and get back short quoted passages with their document titles. Use it before answering any question that turns on a specific price, policy, claim, number, or case study. Returns nothing when no document matches, which means the fact is unrecorded rather than untrue.",
      inputSchema: searchBrandKnowledgeInputSchema,
      execute: async ({ query }) =>
        searchBrandKnowledge({ workspaceId: input.workspaceId, query }),
    }),
  };
}
