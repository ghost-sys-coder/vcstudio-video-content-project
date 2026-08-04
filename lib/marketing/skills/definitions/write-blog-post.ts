import { z } from "zod";
import { MARKETING_SKILL_PROMPT_VERSION } from "@studio/prompts";
import { MARKETING_EXPECTED_OUTPUT_TOKENS } from "@/lib/costs/marketing-cost";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
export const writeBlogPostSkill = {
  key: "write_blog_post",
  label: "Write a blog post",
  group: "Content",
  description: "Draft a useful, structured, on-brand blog article.",
  capability: "useMarketingChat",
  execution: "deferred",
  operation: "blog_post",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: true,
  promptVersion: MARKETING_SKILL_PROMPT_VERSION,
  inputSchema: z.object({
    topic: z.string().trim().min(1).max(1000),
    audience: z.string().trim().min(1).max(500),
    length: z.enum(["short", "medium", "long"]),
  }),
  inputFields: [
    { key: "topic", label: "Topic", type: "longtext", required: true },
    { key: "audience", label: "Audience", type: "text", required: true },
    {
      key: "length",
      label: "Length",
      type: "select",
      required: true,
      options: ["short", "medium", "long"],
    },
  ],
  billing: {
    kind: "text",
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.blog_post,
  },
  instructions:
    "Write a well-structured article with a descriptive title, clear headings, a useful argument, and an appropriate conclusion. Avoid filler and unsupported SEO claims.",
  estimatedCostRangeCents: [3, 12],
} satisfies MarketingSkillDefinition;
