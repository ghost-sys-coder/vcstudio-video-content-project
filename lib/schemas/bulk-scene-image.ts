import { z } from "zod";
import {
  sceneImageQualitySchema,
  uniqueSceneImageSizesSchema,
} from "@/lib/schemas/scene-image";

const uniqueSceneIdsSchema = z
  .array(z.uuid())
  .min(1, "Select at least one scene.")
  .max(200)
  .superRefine((sceneIds, context) => {
    if (new Set(sceneIds).size !== sceneIds.length)
      context.addIssue({
        code: "custom",
        message: "Scene selection must be unique.",
      });
  });

export const startBulkSceneImageGenerationSchema = z.object({
  projectId: z.uuid(),
  stylePresetVersionId: z.uuid(),
  quality: sceneImageQualitySchema,
  requestNonce: z.uuid(),
  sceneIds: uniqueSceneIdsSchema,
  sizes: uniqueSceneImageSizesSchema,
});

export const cancelSceneImageBatchSchema = z.object({
  projectId: z.uuid(),
  batchId: z.uuid(),
});

export const storyboardDetailsRouteParamsSchema = z.object({
  projectId: z.uuid(),
});

export type StartBulkSceneImageGenerationInput = z.infer<
  typeof startBulkSceneImageGenerationSchema
>;
export type CancelSceneImageBatchInput = z.infer<
  typeof cancelSceneImageBatchSchema
>;
