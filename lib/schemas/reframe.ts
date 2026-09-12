import { z } from "zod";

export const reframeRequestSchema = z.object({
  projectId: z.uuid(),
  outputVariantId: z.uuid(),
});

export const cancelReframeSchema = z.object({
  projectId: z.uuid(),
  jobId: z.uuid(),
});
