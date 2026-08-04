import { z } from "zod";
import { MARKETING_SKILL_PROMPT_VERSION } from "@studio/prompts";
import { MARKETING_EXPECTED_OUTPUT_TOKENS } from "@/lib/costs/marketing-cost";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
export const createMediaStorySkill = {
  key: "create_media_story",
  label: "Create a media story",
  group: "Content",
  description: "Write a vertical-first sequence of short story cards.",
  capability: "useMarketingChat",
  execution: "inline",
  operation: "media_story",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: true,
  promptVersion: MARKETING_SKILL_PROMPT_VERSION,
  inputSchema: z.object({
    platform: z.enum(["instagram", "facebook", "tiktok", "youtube"]),
    topic: z.string().trim().min(1).max(1000),
    cards: z.enum(["3", "5", "7"]),
  }),
  inputFields: [
    {
      key: "platform",
      label: "Platform",
      type: "platform",
      required: true,
      options: ["instagram", "facebook", "tiktok", "youtube"],
    },
    {
      key: "topic",
      label: "Topic",
      type: "longtext",
      required: true,
      defaultValue:
        "Five quick signs that a growing business has outgrown its current website.",
    },
    {
      key: "cards",
      label: "Cards",
      type: "select",
      required: true,
      options: ["3", "5", "7"],
    },
  ],
  billing: {
    kind: "text",
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.media_story,
  },
  instructions:
    "Write a numbered sequence of concise vertical story cards. Each card needs on-screen copy and a brief visual direction; the final card carries the call to action.",
  estimatedCostRangeCents: [1, 5],
} satisfies MarketingSkillDefinition;
