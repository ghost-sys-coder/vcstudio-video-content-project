import { z } from "zod";

export const sceneImageGenerationMutationSchema = z.object({
  projectId: z.uuid(),
  generationId: z.uuid(),
});

export const sceneImageDetailsQuerySchema = z.object({
  sceneVersionId: z.uuid(),
});

export const sceneImageDetailsRouteParamsSchema = z.object({
  projectId: z.uuid(),
  sceneId: z.uuid(),
});

export const sceneImageAssetRouteParamsSchema = z.object({
  projectId: z.uuid(),
  generationId: z.uuid(),
});
