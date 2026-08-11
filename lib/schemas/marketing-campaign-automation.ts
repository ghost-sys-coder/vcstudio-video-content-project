import { z } from "zod";
import { contentPlatformEnum } from "@/db/schema";

export const campaignContentPlanSchema = z.object({
  strategySummary: z.string().trim().min(1).max(5_000),
  items: z
    .array(
      z.object({
        conceptKey: z.string().trim().min(1).max(80),
        connectionId: z.uuid(),
        platform: z.enum(contentPlatformEnum.enumValues),
        kind: z.enum(["social_post", "graphic", "media_story"]),
        title: z.string().trim().min(1).max(255),
        body: z.string().trim().min(1).max(5_000),
        scheduledDayOffset: z.number().int().nonnegative().max(365),
        mediaAssetId: z.uuid().nullable(),
        visualDirection: z.string().trim().min(1).max(2_000),
        researchSnapshotIds: z.array(z.uuid()).min(1).max(10),
        researchRationale: z.string().trim().min(1).max(2_000),
      }),
    )
    .min(1)
    .max(30),
});

export type CampaignContentPlan = z.infer<typeof campaignContentPlanSchema>;
