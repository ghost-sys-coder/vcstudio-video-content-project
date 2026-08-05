import { z } from "zod";
import { contentPlatformEnum } from "@/db/schema";

export const campaignContentPlanSchema = z
  .object({
    strategySummary: z.string().trim().min(1).max(5_000),
    items: z
      .array(
        z.object({
          platform: z.enum(contentPlatformEnum.enumValues),
          kind: z.enum([
            "social_post",
            "ad_creative",
            "graphic",
            "media_story",
          ]),
          title: z.string().trim().min(1).max(255),
          body: z.string().trim().min(1).max(5_000),
          trafficType: z.enum(["organic", "paid"]),
          scheduledDayOffset: z.number().int().nonnegative().max(365),
          mediaAssetId: z.uuid().nullable(),
          visualDirection: z.string().trim().min(1).max(2_000),
          researchSnapshotIds: z.array(z.uuid()).min(1).max(10),
          researchRationale: z.string().trim().min(1).max(2_000),
          adPayload: z
            .object({
              headline: z.string().trim().min(1).max(255),
              description: z.string().trim().max(500),
              cta: z.string().trim().min(1).max(80),
              placement: z.string().trim().min(1).max(120),
              variantLabel: z.string().trim().min(1).max(80),
            })
            .nullable(),
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((plan, context) => {
    plan.items.forEach((item, index) => {
      if (item.kind === "ad_creative" && item.adPayload === null)
        context.addIssue({
          code: "custom",
          path: ["items", index, "adPayload"],
          message: "Ad creative requires an ad payload.",
        });
    });
  });

export type CampaignContentPlan = z.infer<typeof campaignContentPlanSchema>;
