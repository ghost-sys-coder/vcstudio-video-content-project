import { z } from "zod";
import { MARKETING_SKILL_PROMPT_VERSION } from "@studio/prompts";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

export const socialMediaManagerSkill = {
  key: "social_media_manager",
  label: "Plan a social media week",
  group: "Content",
  description:
    "Create a bounded set of platform-native drafts for human review.",
  toolDescription:
    "Plan and draft up to five social posts. Use business facts and brand context, but never approve or publish them.",
  capability: "useMarketingChat",
  execution: "deferred",
  operation: "content_draft",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: true,
  promptVersion: MARKETING_SKILL_PROMPT_VERSION,
  inputSchema: z.object({
    platform: z.enum(SOCIAL_POST_PLATFORMS),
    topic: z.string().trim().min(1).max(1000),
    goal: z.string().trim().min(1).max(500),
    itemCount: z.number().int().min(1).max(5),
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
      label: "Weekly theme",
      type: "longtext",
      required: true,
      defaultValue:
        "Share a practical weekly series that helps small businesses improve customer acquisition.",
    },
    {
      key: "goal",
      label: "Goal",
      type: "text",
      required: true,
      defaultValue:
        "Build trust and invite qualified prospects to start a conversation.",
    },
    {
      key: "itemCount",
      label: "Drafts",
      type: "number",
      required: true,
      defaultValue: "3",
      minimum: 1,
      maximum: 5,
    },
  ],
  billing: { kind: "text", expectedOutputTokens: 5_000 },
  instructions:
    "Produce the requested number of distinct platform-native organic posts. Ground claims in the supplied brand and business context. Each post needs a clear purpose and call to action. Do not claim that anything was approved, scheduled, or published.",
  estimatedCostRangeCents: [2, 12],
} satisfies MarketingSkillDefinition;
