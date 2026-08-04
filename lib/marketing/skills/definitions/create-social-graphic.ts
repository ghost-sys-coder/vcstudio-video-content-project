import { z } from "zod";
import { MARKETING_SKILL_PROMPT_VERSION } from "@studio/prompts";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

export const createSocialGraphicSkill = {
  key: "create_social_graphic",
  label: "Create a social graphic",
  group: "Content",
  description:
    "Generate an on-brand social image and save it to the media library for review.",
  capability: "useMarketingChat",
  execution: "deferred",
  operation: "image_generation",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: true,
  promptVersion: MARKETING_SKILL_PROMPT_VERSION,
  inputSchema: z.object({
    platform: z.enum(SOCIAL_POST_PLATFORMS),
    topic: z.string().trim().min(1).max(1000),
    visualDirection: z.string().trim().min(1).max(1000),
    aspectRatio: z.enum(["square", "portrait", "landscape"]),
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
        "Announce our new website redesign service for growing local businesses.",
    },
    {
      key: "visualDirection",
      label: "Visual direction",
      type: "longtext",
      required: true,
      defaultValue:
        "A confident founder at a clean desk, warm natural light, deep navy and electric-blue accents, generous negative space, no text in the image.",
    },
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      required: true,
      options: ["square", "portrait", "landscape"],
    },
  ],
  billing: { kind: "image", quality: "medium" },
  instructions:
    "Create one polished social graphic. Use the supplied brand context, a clear focal point, strong composition, and minimal visual clutter. Do not render logos, claims, or factual text that were not supplied.",
  estimatedCostRangeCents: [6, 9],
} satisfies MarketingSkillDefinition;
