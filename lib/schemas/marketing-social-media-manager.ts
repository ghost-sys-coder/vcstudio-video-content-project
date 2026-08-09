import { z } from "zod";

export const marketingSocialMediaManagerOutputSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(5_000),
        rationale: z.string().trim().min(1).max(500),
      }),
    )
    .min(1)
    .max(5),
});
