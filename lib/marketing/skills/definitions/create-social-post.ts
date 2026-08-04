import { z } from "zod";
import { MARKETING_SKILL_PROMPT_VERSION } from "@studio/prompts";
import { MARKETING_EXPECTED_OUTPUT_TOKENS } from "@/lib/costs/marketing-cost";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

export const createSocialPostSkill = {
  key: "create_social_post",
  label: "Create a social post",
  group: "Content",
  description:
    "Write an on-brand organic social post for a specified platform and goal.",
  capability: "useMarketingChat",
  execution: "inline",
  operation: "content_draft",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: true,
  promptVersion: MARKETING_SKILL_PROMPT_VERSION,
  inputSchema: z.object({
    platform: z.enum(SOCIAL_POST_PLATFORMS),
    topic: z.string().trim().min(1).max(1000),
    goal: z.string().trim().min(1).max(500),
  }),
  inputFields: [
    {
      key: "platform",
      label: "Platform",
      type: "platform",
      required: true,
      options: SOCIAL_POST_PLATFORMS,
    },
    {
      key: "topic",
      label: "Topic",
      type: "longtext",
      required: true,
      defaultValue:
        "Share three signs that a small business website is losing qualified leads.",
    },
    {
      key: "goal",
      label: "Goal",
      type: "text",
      required: true,
      defaultValue:
        "Start conversations with founders and invite them to request an audit.",
    },
  ],
  billing: {
    kind: "text",
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.content_draft,
  },
  instructions:
    "Write one platform-native organic post with a strong opening, useful body, and appropriate call to action. Respect the platform's conventions without fabricating facts.",
  estimatedCostRangeCents: [1, 4],
} satisfies MarketingSkillDefinition;
