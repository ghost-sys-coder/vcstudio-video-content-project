import { asSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const searched = vi.hoisted(() => ({
  calls: [] as { workspaceId: string; query: string }[],
}));
vi.mock("@/lib/marketing/chat/search-brand-knowledge", async (original) => ({
  ...(await original()),
  searchBrandKnowledge: async (input: {
    workspaceId: string;
    query: string;
  }) => {
    searched.calls.push(input);
    return { results: [] };
  },
}));
vi.mock("@/lib/marketing/skills/execute-inline-skill", () => ({
  executeInlineMarketingSkill: vi.fn(),
}));
import {
  buildChatTools,
  getBillableChatToolNames,
} from "@/lib/marketing/chat/build-chat-tools";
import { MARKETING_SKILL_REGISTRY } from "@/lib/marketing/skills/skill-registry";
import { MARKETING_SKILL_KEYS } from "@/lib/marketing/skills/skill-key";

const context = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  role: "owner" as const,
  threadId: "33333333-3333-4333-8333-333333333333",
  messageId: "44444444-4444-4444-8444-444444444444",
  brandContext: "Brand",
  brandContextFingerprint: "fingerprint",
};
const definitions = Object.values(MARKETING_SKILL_REGISTRY);

describe("buildChatTools", () => {
  it("keeps the key union and registry exhaustive", () => {
    expect(Object.keys(MARKETING_SKILL_REGISTRY).sort()).toEqual(
      [...MARKETING_SKILL_KEYS].sort(),
    );
  });
  it("serialises every input schema as a non-empty object", async () => {
    const tools = buildChatTools({ definitions, context });
    for (const key of MARKETING_SKILL_KEYS) {
      const schema = await asSchema(tools[key]!.inputSchema).jsonSchema;
      expect(schema.type).toBe("object");
      expect(Object.keys(schema.properties ?? {}).length).toBeGreaterThan(0);
    }
  });
  it("scopes free knowledge search to the closed-over workspace", async () => {
    searched.calls = [];
    const tools = buildChatTools({ definitions, context });
    await tools.search_brand_knowledge!.execute!(
      { query: "pricing" },
      { toolCallId: "call-1", messages: [], context: undefined },
    );
    expect(searched.calls).toEqual([
      { workspaceId: context.workspaceId, query: "pricing" },
    ]);
  });
  it("registers every paid skill with the turn cost ceiling", () => {
    expect(getBillableChatToolNames(definitions).sort()).toEqual(
      MARKETING_SKILL_KEYS.filter(
        (key) => key !== "search_brand_knowledge",
      ).sort(),
    );
  });
});
