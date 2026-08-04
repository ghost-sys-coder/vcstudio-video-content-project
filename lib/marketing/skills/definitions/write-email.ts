import { z } from "zod";
import { MARKETING_SKILL_PROMPT_VERSION } from "@studio/prompts";
import { MARKETING_EXPECTED_OUTPUT_TOKENS } from "@/lib/costs/marketing-cost";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
export const writeEmailSkill = {
  key: "write_email",
  label: "Write an email",
  group: "Content",
  description:
    "Draft an on-brand marketing email with subject lines and body copy.",
  capability: "useMarketingChat",
  execution: "inline",
  operation: "email_draft",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: true,
  promptVersion: MARKETING_SKILL_PROMPT_VERSION,
  inputSchema: z.object({
    audience: z.string().trim().min(1).max(500),
    purpose: z.string().trim().min(1).max(1000),
    callToAction: z.string().trim().min(1).max(500),
  }),
  inputFields: [
    {
      key: "audience",
      label: "Audience",
      type: "text",
      required: true,
      defaultValue: "Past clients whose websites are over three years old",
    },
    {
      key: "purpose",
      label: "Purpose",
      type: "longtext",
      required: true,
      defaultValue:
        "Introduce our website health-check service and explain the three issues it uncovers.",
    },
    {
      key: "callToAction",
      label: "Call to action",
      type: "text",
      required: true,
      defaultValue: "Book a free 20-minute website review",
    },
  ],
  billing: {
    kind: "text",
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.email_draft,
  },
  instructions:
    "Write three subject-line options, preview text, and a concise email body. Keep claims grounded in the brand context.",
  estimatedCostRangeCents: [1, 5],
} satisfies MarketingSkillDefinition;
