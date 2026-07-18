import { z } from "zod";

export const AUDIO_FORMATS = [
  "mp3",
  "opus",
  "aac",
  "flac",
  "wav",
  "pcm",
] as const;

export const audioFormatSchema = z.enum(AUDIO_FORMATS);

export const voicePresetInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  voice: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(64),
  instructions: z.string().trim().max(2000).default(""),
  speedScaledPercent: z.coerce.number().int().min(25).max(400).default(100),
  format: audioFormatSchema.default("mp3"),
  isDefault: z.coerce.boolean().default(false),
});

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

export const startSceneAudioGenerationSchema = z.object({
  projectId: z.uuid(),
  sceneId: z.uuid(),
  sceneVersionId: z.uuid(),
  voicePresetId: z.uuid(),
  requestNonce: z.uuid(),
});

export const startBulkSceneAudioGenerationSchema = z.object({
  projectId: z.uuid(),
  voicePresetId: z.uuid(),
  requestNonce: z.uuid(),
  sceneIds: uniqueSceneIdsSchema,
});

export const sceneAudioGenerationMutationSchema = z.object({
  projectId: z.uuid(),
  generationId: z.uuid(),
});

export const createVoicePresetSchema = voicePresetInputSchema.extend({
  workspaceId: z.uuid(),
});

export const audioRouteParamsSchema = z.object({
  projectId: z.uuid(),
});

export type VoicePresetInput = z.infer<typeof voicePresetInputSchema>;
export type StartSceneAudioGenerationInput = z.infer<
  typeof startSceneAudioGenerationSchema
>;
export type StartBulkSceneAudioGenerationInput = z.infer<
  typeof startBulkSceneAudioGenerationSchema
>;
export type SceneAudioFormat = z.infer<typeof audioFormatSchema>;
