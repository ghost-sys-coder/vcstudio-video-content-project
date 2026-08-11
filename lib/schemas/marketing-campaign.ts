import { z } from "zod";
import {
  contentPlatformEnum,
  marketingCampaignObjectiveEnum,
  marketingCampaignStatusEnum,
  marketingTrafficTypeEnum,
} from "@/db/schema";
import { portableDocumentSchema } from "@/lib/social/portable-document";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const marketingCampaignInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    objective: z.enum(marketingCampaignObjectiveEnum.enumValues),
    trafficType: z.enum(marketingTrafficTypeEnum.enumValues).default("organic"),
    brandProfileId: z.uuid(),
    connectionIds: z.array(z.uuid()).min(1).max(30),
    status: z.enum(marketingCampaignStatusEnum.enumValues).default("draft"),
    startDate: isoDateSchema,
    endDate: z
      .union([isoDateSchema, z.literal("")])
      .nullable()
      .optional(),
    audienceId: z
      .union([z.uuid(), z.literal("")])
      .nullable()
      .optional(),
    offerId: z
      .union([z.uuid(), z.literal("")])
      .nullable()
      .optional(),
    keyMessage: z.string().trim().max(2_000).default(""),
    hypothesis: z.string().trim().max(2_000).default(""),
    platforms: z.array(z.enum(contentPlatformEnum.enumValues)).min(1).max(6),
    briefPlainText: z.string().trim().max(10_000).default(""),
    isBranded: z.boolean().default(true),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End date must not be before start date.",
  });

export const marketingCampaignMutationSchema = marketingCampaignInputSchema
  .extend({ campaignId: z.uuid().optional() })
  .transform((value) => ({
    ...value,
    campaignId: value.campaignId,
    endDate: value.endDate || null,
    audienceId: value.audienceId || null,
    offerId: value.offerId || null,
  }));

export const marketingCampaignIdSchema = z.object({ campaignId: z.uuid() });

export const marketingCampaignBriefDocumentSchema = portableDocumentSchema;

export type MarketingCampaignInput = z.infer<
  typeof marketingCampaignMutationSchema
>;
