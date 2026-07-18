import { z } from "zod";

const booleanFlagSchema = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((value) => value === true || value === "true");

export const renderRouteParamsSchema = z.object({
  projectId: z.uuid(),
});

export const renderDownloadParamsSchema = z.object({
  projectId: z.uuid(),
  renderId: z.uuid(),
});

export const startRenderSchema = z.object({
  projectId: z.uuid(),
  presetId: z.string().trim().min(1).max(64),
  includeCaptions: booleanFlagSchema,
  includeWatermark: booleanFlagSchema,
  requestNonce: z.uuid(),
});

export const cancelRenderSchema = z.object({
  projectId: z.uuid(),
  renderId: z.uuid(),
});

export type StartRenderRequest = z.infer<typeof startRenderSchema>;
