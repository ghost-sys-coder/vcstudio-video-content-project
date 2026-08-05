import { z } from "zod";

export const marketingCompetitorInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  websiteUrl: z.union([z.url(), z.literal("")]),
  notes: z.string().trim().max(2_000).default(""),
});
