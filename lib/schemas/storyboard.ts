import { z } from "zod";
import { sceneImageApiSizeSchema } from "@/lib/schemas/scene-image";

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

const imageGenerationStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

const storyboardSceneSchema = z.object({
  sceneId: z.uuid(),
  sceneNumber: z.number().int().positive(),
  sceneStatus: z.enum([
    "draft",
    "review",
    "approved",
    "generating",
    "generated",
    "revisionRequired",
    "locked",
  ]),
  sceneVersionId: z.uuid(),
  narrationText: z.string(),
  characterNames: z.array(z.string()),
  durationMilliseconds: z.number().int().nonnegative(),
  eligibility: z.enum([
    "eligible",
    "hasApprovedImage",
    "inProgress",
    "notApproved",
  ]),
  approvedImageUrl: z.string().nullable(),
  latestImageUrl: z.string().nullable(),
  latestGenerationId: z.uuid().nullable(),
  latestStatus: imageGenerationStatusSchema.nullable(),
  latestReviewStatus: z.enum(["pending", "approved", "rejected"]).nullable(),
  latestGenerationVersion: z.number().int().positive().nullable(),
  progressPercent: z.number().int().min(0).max(100),
  estimatedCostCents: z.number().int().nonnegative().nullable(),
  actualCostCents: z.number().int().nonnegative().nullable(),
  safeErrorMessage: z.string().nullable(),
});

const batchCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});

const storyboardBatchSchema = z.object({
  id: z.uuid(),
  displayStatus: z.enum([
    "pending",
    "processing",
    "completed",
    "completedWithErrors",
    "cancelled",
  ]),
  counts: batchCountsSchema,
  estimatedCostCents: z.number().int().nonnegative(),
  actualCostCents: z.number().int().nonnegative(),
  requestedSceneCount: z.number().int().nonnegative(),
  reservedSceneCount: z.number().int().nonnegative(),
  createdAtLabel: z.string(),
});

export const storyboardResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: z.object({
      scenes: z.array(storyboardSceneSchema),
      stylePresets: z.array(stylePresetViewSchema),
      latestBatch: storyboardBatchSchema.nullable(),
      configuration: z.object({
        enabled: z.boolean(),
        maximumImagesPerBatch: z.number().int().min(1).max(100),
        manualConfirmationThresholdCents: z.number().int().min(0),
        draftQuality: z.literal("low"),
        finalQuality: z.literal("medium"),
        defaultSize: sceneImageApiSizeSchema,
        outputCostMatrix: z.object({
          low: costBySizeSchema,
          medium: costBySizeSchema,
          high: costBySizeSchema,
        }),
      }),
      availableBudgetCents: z.number().int().nonnegative(),
      promptTemplateVersion: z.string(),
    }),
  }),
  z.object({ success: z.literal(false), error: z.string() }),
]);
