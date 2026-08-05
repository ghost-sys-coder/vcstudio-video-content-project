import { z } from "zod";
import type { MarketingSkillDefinition } from "@/lib/marketing/skills/skill-definition";

export const createVideoDraftSkill = {
  key: "create_video_draft",
  label: "Create a video draft",
  group: "Content",
  description:
    "Create a project, generate its script, and prepare storyboard scenes for review.",
  capability: "useMarketingChat",
  execution: "deferred",
  operation: null,
  rateLimitOperation: null,
  requiresBrandProfile: false,
  promptVersion: "marketing-video-draft-orchestration-v1",
  inputSchema: z.object({
    title: z.string().trim().min(2).max(160),
    topic: z.string().trim().min(2).max(2_000),
    audience: z.string().trim().min(1).max(1_000),
    tone: z.string().trim().min(1).max(200),
    platform: z.enum([
      "youtube",
      "tiktok",
      "instagram",
      "facebook",
      "linkedin",
      "twitter",
    ]),
    aspectRatio: z.enum(["portrait", "landscape", "square"]),
    durationSeconds: z.coerce.number().int().min(15).max(3_600),
    hookAngle: z.string().trim().min(1).max(1_000),
  }),
  inputFields: [
    {
      key: "title",
      label: "Project title",
      type: "text",
      required: true,
      defaultValue: "Why a clearer website wins more customers",
    },
    {
      key: "topic",
      label: "Topic",
      type: "longtext",
      required: true,
      defaultValue:
        "Explain how a strategic website redesign helps growing local businesses turn more visits into qualified enquiries.",
    },
    {
      key: "audience",
      label: "Audience",
      type: "text",
      required: true,
      defaultValue: "Owners of growing local service businesses",
    },
    {
      key: "tone",
      label: "Tone",
      type: "text",
      required: true,
      defaultValue: "Clear, confident, practical, and warm",
    },
    {
      key: "platform",
      label: "Primary platform",
      type: "platform",
      required: true,
      options: [
        "youtube",
        "tiktok",
        "instagram",
        "facebook",
        "linkedin",
        "twitter",
      ],
    },
    {
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "select",
      required: true,
      options: ["portrait", "landscape", "square"],
    },
    {
      key: "durationSeconds",
      label: "Target duration (seconds)",
      type: "text",
      required: true,
      defaultValue: "60",
    },
    {
      key: "hookAngle",
      label: "Hook angle",
      type: "longtext",
      required: true,
      defaultValue:
        "Your website may be costing you customers before they ever contact you.",
    },
  ],
  billing: { kind: "free" },
  instructions:
    "Orchestrate the existing project script-generation and scene-analysis workflows, then stop before image generation.",
  estimatedCostRangeCents: [2, 20],
} satisfies MarketingSkillDefinition;
