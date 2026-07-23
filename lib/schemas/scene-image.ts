import { z } from "zod";

export const SCENE_IMAGE_API_SIZES = [
  "1536x1024",
  "1024x1536",
  "1024x1024",
] as const;
export const SCENE_IMAGE_QUALITIES = ["low", "medium", "high"] as const;
export const SCENE_IMAGE_OUTPUT_FORMATS = ["webp", "png", "jpeg"] as const;
export const SCENE_IMAGE_BACKGROUNDS = ["opaque", "auto"] as const;

export const sceneImageApiSizeSchema = z.enum(SCENE_IMAGE_API_SIZES);
export const sceneImageQualitySchema = z.enum(SCENE_IMAGE_QUALITIES);
export const sceneImageOutputFormatSchema = z.enum(SCENE_IMAGE_OUTPUT_FORMATS);
export const sceneImageBackgroundSchema = z.enum(SCENE_IMAGE_BACKGROUNDS);

const uniqueReferenceAssetIdsSchema = z
  .array(z.uuid())
  .max(16)
  .superRefine((referenceAssetIds, context) => {
    if (new Set(referenceAssetIds).size !== referenceAssetIds.length)
      context.addIssue({
        code: "custom",
        message: "Reference assets must be unique.",
      });
  })
  .transform((referenceAssetIds) => [...referenceAssetIds].sort());

export const uniqueSceneImageSizesSchema = z
  .array(sceneImageApiSizeSchema)
  .min(1, "Select at least one size.")
  .max(SCENE_IMAGE_API_SIZES.length)
  .superRefine((sizes, context) => {
    if (new Set(sizes).size !== sizes.length)
      context.addIssue({
        code: "custom",
        message: "Sizes must be unique.",
      });
  });

export const startSceneImageGenerationSchema = z.object({
  projectId: z.uuid(),
  sceneId: z.uuid(),
  sceneVersionId: z.uuid(),
  stylePresetVersionId: z.uuid(),
  requestNonce: z.uuid(),
  quality: sceneImageQualitySchema,
  sizes: uniqueSceneImageSizesSchema,
  referenceAssetIds: uniqueReferenceAssetIdsSchema,
});

export const sceneImageProviderConfigurationSchema = z.object({
  model: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1).max(32_000),
  quality: sceneImageQualitySchema,
  size: sceneImageApiSizeSchema,
  outputFormat: sceneImageOutputFormatSchema,
  outputCompression: z.number().int().min(1).max(100),
  background: sceneImageBackgroundSchema,
  endUserId: z.string().trim().min(1).max(128).optional(),
});

export type SceneImageApiSize = z.infer<typeof sceneImageApiSizeSchema>;
export type SceneImageQuality = z.infer<typeof sceneImageQualitySchema>;
export type SceneImageOutputFormat = z.infer<
  typeof sceneImageOutputFormatSchema
>;
export type SceneImageBackground = z.infer<typeof sceneImageBackgroundSchema>;
export type StartSceneImageGenerationInput = z.infer<
  typeof startSceneImageGenerationSchema
>;
export type SceneImageProviderConfiguration = z.infer<
  typeof sceneImageProviderConfigurationSchema
>;

export type SceneImageDimensions = { width: number; height: number };

export function getSceneImageDimensions(
  size: SceneImageApiSize,
): SceneImageDimensions {
  if (size === "1536x1024") return { width: 1536, height: 1024 };
  if (size === "1024x1536") return { width: 1024, height: 1536 };
  return { width: 1024, height: 1024 };
}

export function getSceneImageSizeForAspectRatio(
  aspectRatio: "16:9" | "9:16" | "1:1",
): SceneImageApiSize {
  if (aspectRatio === "16:9") return "1536x1024";
  if (aspectRatio === "9:16") return "1024x1536";
  return "1024x1024";
}

/**
 * Inverse of {@link getSceneImageSizeForAspectRatio}. A generation's prompt
 * must describe the composition of the size actually being produced, not the
 * project's overall aspect ratio — otherwise a native portrait/square
 * generation would carry landscape framing guidance.
 */
export function getAspectRatioForSceneImageSize(
  size: SceneImageApiSize,
): "16:9" | "9:16" | "1:1" {
  if (size === "1536x1024") return "16:9";
  if (size === "1024x1536") return "9:16";
  return "1:1";
}
