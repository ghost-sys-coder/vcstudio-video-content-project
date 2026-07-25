import { z } from "zod";
import {
  sceneImageApiSizeSchema,
  sceneImageOutputFormatSchema,
  sceneImageQualitySchema,
} from "@/lib/schemas/scene-image";

const costBySizeSchema = z.object({
  "1536x1024": z.number().int().nonnegative(),
  "1024x1536": z.number().int().nonnegative(),
  "1024x1024": z.number().int().nonnegative(),
});

const stylePresetViewSchema = z.object({
  id: z.uuid(),
  versionId: z.uuid(),
  name: z.string(),
  description: z.string(),
  version: z.number().int().positive(),
  isDefault: z.boolean(),
  positivePrompt: z.string(),
  negativePrompt: z.string(),
  defaultAspectRatio: z.enum(["16:9", "9:16", "1:1"]),
});

const referenceViewSchema = z.object({
  id: z.uuid(),
  characterId: z.uuid(),
  characterName: z.string(),
  typeLabel: z.string(),
  referenceType: z.string(),
  thumbnailUrl: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const generationViewSchema = z.object({
  id: z.uuid(),
  generationVersion: z.number().int().positive(),
  status: z.enum([
    "pending",
    "queued",
    "running",
    "succeeded",
    "failed",
    "cancelled",
  ]),
  reviewStatus: z.enum(["pending", "approved", "rejected"]),
  source: z.enum(["ai_generated", "user_uploaded"]),
  model: z.string().nullable(),
  quality: sceneImageQualitySchema.nullable(),
  size: sceneImageApiSizeSchema,
  outputFormat: sceneImageOutputFormatSchema,
  outputCompression: z.number().int().min(1).max(100).nullable(),
  finalPrompt: z.string().nullable(),
  promptTemplateVersion: z.string().nullable(),
  stylePresetName: z.string().nullable(),
  stylePresetVersion: z.number().int().positive().nullable(),
  imageUrl: z.string().nullable(),
  estimatedCostCents: z.number().int().nonnegative(),
  actualCostCents: z.number().int().nonnegative().nullable(),
  progressPercent: z.number().int().min(0).max(100),
  attemptCount: z.number().int().nonnegative(),
  safeErrorMessage: z.string().nullable(),
  reservationReleased: z.boolean(),
  referenceAssetIds: z.array(z.uuid()),
  createdAtLabel: z.string(),
});

export const sceneImageDetailsResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: z.object({
      stylePresets: z.array(stylePresetViewSchema),
      references: z.array(referenceViewSchema),
      generations: z.array(generationViewSchema),
      configuration: z.object({
        enabled: z.boolean(),
        model: z.string(),
        outputFormat: sceneImageOutputFormatSchema,
        draftQuality: z.literal("low"),
        finalQuality: z.literal("medium"),
        draftCompression: z.number().int().min(1).max(100),
        finalCompression: z.number().int().min(1).max(100),
        maximumReferenceAssets: z.number().int().min(1).max(16),
        defaultSize: sceneImageApiSizeSchema,
        textInputCostPerMillionCents: z.number().int().positive(),
        referenceInputReserveCents: z.number().int().nonnegative(),
        outputCostMatrix: z.object({
          low: costBySizeSchema,
          medium: costBySizeSchema,
          high: costBySizeSchema,
        }),
      }),
      promptTemplateVersion: z.string(),
      availableBudgetCents: z.number().int().nonnegative(),
      defaultReferenceAssetIds: z.array(z.uuid()),
    }),
  }),
  z.object({ success: z.literal(false), error: z.string() }),
]);
