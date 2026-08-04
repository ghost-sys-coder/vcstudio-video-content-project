import { z } from "zod";
import { MARKETING_SKILL_PROMPT_VERSION } from "@studio/prompts";
import { MARKETING_EXPECTED_OUTPUT_TOKENS } from "@/lib/costs/marketing-cost";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
export const trainBusinessKnowledgeSkill = {
  key: "train_business_knowledge",
  label: "Train the AI about the business",
  group: "Knowledge",
  description:
    "Turn supplied business facts into a clean, reviewable knowledge note.",
  capability: "manageBrandProfile",
  execution: "inline",
  operation: "document_summary",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: false,
  promptVersion: MARKETING_SKILL_PROMPT_VERSION,
  inputSchema: z.object({
    subject: z.string().trim().min(1).max(500),
    facts: z.string().trim().min(1).max(5000),
  }),
  inputFields: [
    { key: "subject", label: "Subject", type: "text", required: true },
    { key: "facts", label: "Business facts", type: "longtext", required: true },
  ],
  billing: {
    kind: "text",
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.document_summary,
  },
  instructions:
    "Organise the supplied facts into a concise knowledge note. Clearly distinguish explicit facts from missing information. Do not claim that the note has already changed stored brand data.",
  estimatedCostRangeCents: [1, 5],
} satisfies MarketingSkillDefinition;
