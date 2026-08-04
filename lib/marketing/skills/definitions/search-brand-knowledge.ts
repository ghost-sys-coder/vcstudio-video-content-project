import { MARKETING_CHAT_PROMPT_VERSION } from "@studio/prompts";
import { searchBrandKnowledgeInputSchema } from "@/lib/marketing/chat/search-brand-knowledge";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
export const searchBrandKnowledgeSkill = {
  key: "search_brand_knowledge",
  label: "Search brand knowledge",
  group: "Knowledge",
  description: "Search uploaded business documents for grounded facts.",
  capability: "useMarketingChat",
  execution: "inline",
  operation: null,
  rateLimitOperation: null,
  requiresBrandProfile: false,
  promptVersion: MARKETING_CHAT_PROMPT_VERSION,
  inputSchema: searchBrandKnowledgeInputSchema,
  inputFields: [
    {
      key: "query",
      label: "Search query",
      type: "text",
      required: true,
      defaultValue: "What turnaround time do we promise for website projects?",
    },
  ],
  billing: { kind: "free" },
  instructions: "Search the workspace knowledge corpus.",
  estimatedCostRangeCents: [0, 0],
} satisfies MarketingSkillDefinition;
