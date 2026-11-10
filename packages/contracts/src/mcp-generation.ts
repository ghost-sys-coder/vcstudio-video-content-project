import { z } from "zod";
import { mcpMutationInput, mcpWorkspaceInput } from "./mcp";
import { MAX_SHOTS_PER_SCENE } from "./scene-media";
export const MAX_STANDALONE_AUDIO_SEGMENTS = 4;

export const IMAGE_GENERATION_SIZES = [
  "1536x1024",
  "1024x1536",
  "1024x1024",
] as const;
export const IMAGE_GENERATION_QUALITIES = ["low", "medium", "high"] as const;
export const imageGenerationSizeSchema = z.enum(IMAGE_GENERATION_SIZES);
export const imageGenerationQualitySchema = z.enum(IMAGE_GENERATION_QUALITIES);
const maximumCostCents = z.number().int().min(1).max(100000);
const references = z
  .array(z.uuid())
  .max(16)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Choose each reference once.",
  )
  .default([]);
const image = z.object({
  size: imageGenerationSizeSchema,
  quality: imageGenerationQualitySchema,
  referenceAssetIds: references,
});
const scene = z.object({
  projectId: z.uuid(),
  sceneId: z.uuid(),
  sceneVersionId: z.uuid(),
  expectedSceneVersion: z.number().int().positive(),
});
export const mcpGenerationRequestSchema = z.discriminatedUnion("kind", [
  image.extend({
    kind: z.literal("image"),
    title: z.string().trim().max(200).default(""),
    prompt: z.string().trim().min(1).max(24000),
    maximumCostCents,
  }),
  z.object({
    kind: z.literal("audio"),
    title: z.string().trim().max(200).default(""),
    text: z.string().trim().min(1).max(50000),
    voicePresetId: z.uuid(),
    language: z.string().trim().min(2).max(35).default("en-US"),
    maximumCostCents,
  }),
  scene.extend({
    ...image.shape,
    kind: z.literal("scene_image"),
    stylePresetVersionId: z.uuid(),
    shotIndex: z
      .number()
      .int()
      .min(0)
      .max(MAX_SHOTS_PER_SCENE - 1)
      .default(0),
    maximumCostCents,
  }),
  scene.extend({
    kind: z.literal("scene_audio"),
    voicePresetId: z.uuid(),
    maximumCostCents,
  }),
]);
export type McpGenerationRequest = z.infer<typeof mcpGenerationRequestSchema>;
export const mcpPrepareGenerationInput = mcpMutationInput.extend({
  request: mcpGenerationRequestSchema,
});
export const mcpExecuteGenerationInput = mcpMutationInput.extend({
  operationId: z.uuid(),
});
export const mcpGenerationOptionsInput = mcpWorkspaceInput.extend({
  projectId: z.uuid().optional(),
});
export const generationPreviewSchema = z.object({
  kind: z.enum(["image", "audio", "scene_image", "scene_audio"]),
  title: z.string(),
  text: z.string(),
  model: z.string(),
  provider: z.string(),
  estimatedCostCents: z.number().int().nonnegative(),
  maximumCostCents,
  settings: z.array(z.object({ label: z.string(), value: z.string() })),
  projectId: z.uuid().nullable(),
  sceneId: z.uuid().nullable(),
});
export type GenerationPreview = z.infer<typeof generationPreviewSchema>;
