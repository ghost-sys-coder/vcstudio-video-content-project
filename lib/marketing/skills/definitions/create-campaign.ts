import { z } from "zod";
import { MARKETING_CAMPAIGN_PROMPT_VERSION } from "@studio/prompts";
import { MARKETING_EXPECTED_OUTPUT_TOKENS } from "@/lib/costs/marketing-cost";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

export const createCampaignSkill = {
  key: "create_campaign",
  label: "Create a campaign",
  group: "Content",
  description:
    "Create an organic or paid campaign plan and reviewable creative variants.",
  capability: "useMarketingChat",
  execution: "inline",
  operation: "campaign_plan",
  rateLimitOperation: "marketing_content_generation",
  requiresBrandProfile: true,
  promptVersion: MARKETING_CAMPAIGN_PROMPT_VERSION,
  inputSchema: z.object({
    name: z.string().trim().min(2).max(120),
    objective: z.enum([
      "awareness",
      "traffic",
      "leads",
      "sales",
      "retention",
      "hiring",
    ]),
    trafficType: z.enum(["organic", "paid", "both"]),
    platform: z.enum(SOCIAL_POST_PLATFORMS),
    audience: z.string().trim().min(1).max(1_000),
    keyMessage: z.string().trim().min(1).max(2_000),
  }),
  inputFields: [
    {
      key: "name",
      label: "Campaign name",
      type: "text",
      required: true,
      defaultValue: "Website redesign launch",
    },
    {
      key: "objective",
      label: "Objective",
      type: "select",
      required: true,
      options: [
        "awareness",
        "traffic",
        "leads",
        "sales",
        "retention",
        "hiring",
      ],
    },
    {
      key: "trafficType",
      label: "Traffic type",
      type: "select",
      required: true,
      options: ["organic", "paid", "both"],
    },
    {
      key: "platform",
      label: "Primary platform",
      type: "platform",
      required: true,
      options: SOCIAL_POST_PLATFORMS,
    },
    {
      key: "audience",
      label: "Audience",
      type: "text",
      required: true,
      defaultValue: "Founders of growing service businesses",
    },
    {
      key: "keyMessage",
      label: "Key message",
      type: "longtext",
      required: true,
      defaultValue:
        "A clearer, faster website turns more qualified visits into enquiries.",
    },
  ],
  billing: {
    kind: "text",
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.campaign_plan,
  },
  instructions:
    "Create a campaign plan using the dedicated organic or paid campaign prompt selected from traffic type.",
  estimatedCostRangeCents: [20, 500],
} satisfies MarketingSkillDefinition;
