import { z } from "zod";

export const outputVariantIdSchema = z.object({
  projectId: z.uuid(),
  outputVariantId: z.uuid(),
});

export const saveSceneVariantFramingSchema = outputVariantIdSchema.extend({
  sceneId: z.uuid(),
  sceneVersionId: z.uuid(),
  sourceImageGenerationId: z.uuid(),
  mode: z.enum(["cover", "contain"]),
  focalPointXBps: z.coerce.number().int().min(0).max(10000),
  focalPointYBps: z.coerce.number().int().min(0).max(10000),
  scaleBps: z.coerce.number().int().min(10000).max(30000),
  backgroundColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((value) => value.toLowerCase()),
});

export const startSceneOutpaintSchema = outputVariantIdSchema.extend({
  sceneId: z.uuid(),
  sceneVersionId: z.uuid(),
  sourceImageGenerationId: z.uuid(),
  requestNonce: z.uuid(),
});
