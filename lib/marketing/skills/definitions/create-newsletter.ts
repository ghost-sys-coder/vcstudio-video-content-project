import { z } from "zod";
import { MARKETING_SKILL_PROMPT_VERSION } from "@studio/prompts";
import { MARKETING_EXPECTED_OUTPUT_TOKENS } from "@/lib/costs/marketing-cost";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
export const createNewsletterSkill = {
  key: "create_newsletter",
  label: "Create a newsletter",
  group: "Content",
  description: "Draft a complete branded newsletter edition.",
  capability: "useMarketingChat",
  execution: "inline",
  operation: "newsletter_draft",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: true,
  promptVersion: MARKETING_SKILL_PROMPT_VERSION,
  inputSchema: z.object({
    theme: z.string().trim().min(1).max(1000),
    audience: z.string().trim().min(1).max(500),
    highlights: z.string().trim().min(1).max(3000),
  }),
  inputFields: [
    { key: "theme", label: "Theme", type: "text", required: true },
    { key: "audience", label: "Audience", type: "text", required: true },
    {
      key: "highlights",
      label: "Highlights",
      type: "longtext",
      required: true,
    },
  ],
  billing: {
    kind: "text",
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.newsletter_draft,
  },
  instructions:
    "Write subject options, preview text, a short opening, clearly separated sections for the supplied highlights, and one closing call to action.",
  estimatedCostRangeCents: [2, 9],
} satisfies MarketingSkillDefinition;
