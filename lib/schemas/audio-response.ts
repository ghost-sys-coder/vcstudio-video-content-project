import { z } from "zod";
import { audioFormatSchema } from "@/lib/schemas/scene-audio";

const audioStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

const voicePresetViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  voice: z.string(),
  model: z.string(),
  instructions: z.string(),
  speedScaledPercent: z.number().int(),
  format: audioFormatSchema,
  isDefault: z.boolean(),
});

const audioSceneSchema = z.object({
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
  narrationPreview: z.string(),
  characterCount: z.number().int().nonnegative(),
  eligibility: z.enum([
    "eligible",
    "hasApprovedAudio",
    "inProgress",
    "notApproved",
    "noNarration",
  ]),
  latestGenerationId: z.uuid().nullable(),
  latestStatus: audioStatusSchema.nullable(),
  latestReviewStatus: z.enum(["pending", "approved", "rejected"]).nullable(),
  latestGenerationVersion: z.number().int().positive().nullable(),
  progressPercent: z.number().int().min(0).max(100),
  audioUrl: z.string().nullable(),
  approvedAudioUrl: z.string().nullable(),
  durationMilliseconds: z.number().int().nonnegative().nullable(),
  estimatedCostCents: z.number().int().nonnegative().nullable(),
  actualCostCents: z.number().int().nonnegative().nullable(),
  safeErrorMessage: z.string().nullable(),
});

const timelineSceneSchema = z.object({
  sceneId: z.uuid(),
  sceneNumber: z.number().int().positive(),
  startMilliseconds: z.number().int().nonnegative(),
  endMilliseconds: z.number().int().nonnegative(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  durationMilliseconds: z.number().int().nonnegative(),
  hasApprovedAudio: z.boolean(),
});

const progressSchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});

export const audioWorkspaceResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    data: z.object({
      scenes: z.array(audioSceneSchema),
      voicePresets: z.array(voicePresetViewSchema),
      timeline: z.object({
        scenes: z.array(timelineSceneSchema),
        framesPerSecond: z.number().int().positive(),
        paddingMilliseconds: z.number().int().nonnegative(),
        totalDurationMilliseconds: z.number().int().nonnegative(),
        totalFrames: z.number().int().nonnegative(),
        scenesWithApprovedAudio: z.number().int().nonnegative(),
        totalScenes: z.number().int().nonnegative(),
      }),
      configuration: z.object({
        enabled: z.boolean(),
        maximumScenesPerBatch: z.number().int().min(1).max(100),
        manualConfirmationThresholdCents: z.number().int().min(0),
        costPerMillionCharactersCents: z.number().int().positive(),
        minimumEstimateCents: z.number().int().positive(),
        defaultFormat: audioFormatSchema,
      }),
      availableBudgetCents: z.number().int().nonnegative(),
      progress: progressSchema,
    }),
  }),
  z.object({ success: z.literal(false), error: z.string() }),
]);
