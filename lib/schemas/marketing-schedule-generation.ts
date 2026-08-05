import { z } from "zod";
import { contentPlatformEnum } from "@/db/schema";

export const marketingScheduleGenerationSchema = z.object({
  items: z
    .array(
      z.object({
        platform: z.enum(contentPlatformEnum.enumValues),
        title: z.string().trim().min(1).max(255),
        body: z.string().trim().min(1).max(5_000),
        visualDirection: z.string().trim().min(1).max(2_000),
        researchSnapshotIds: z.array(z.uuid()).max(10),
        researchRationale: z.string().trim().min(1).max(2_000),
        mediaAssetId: z.uuid().nullable(),
      }),
    )
    .min(1)
    .max(10),
});
