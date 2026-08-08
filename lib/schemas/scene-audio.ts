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

export const CUSTOM_VOICE_CONSENT_PHRASE =
  "I am the owner of this voice and I consent to OpenAI using this recording to create a synthetic voice.";

export const CUSTOM_VOICE_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/webm",
  "audio/mp4",
] as const;

export type CustomVoiceAudioType = (typeof CUSTOM_VOICE_AUDIO_TYPES)[number];

export function customVoiceAudioTypeFromMimeType(
  mimeType: string,
): CustomVoiceAudioType | null {
  const baseType = mimeType.split(";", 1)[0]?.trim().toLowerCase();
  return CUSTOM_VOICE_AUDIO_TYPES.find((type) => type === baseType) ?? null;
}

export const customVoiceEnrollmentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  language: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
});

export const revokeCustomVoiceSchema = z.object({
  projectId: z.uuid(),
  customVoiceId: z.uuid(),
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

export const SCENE_AUDIO_UPLOAD_CONTENT_TYPES = [
  "audio/webm",
  "audio/mp4",
] as const;

export function createSceneAudioRecordingUploadSchema(input: {
  allowedTypes: string[];
  maximumBytes: number;
}) {
  return z.object({
    sceneId: z.uuid(),
    sceneVersionId: z.uuid(),
    contentType: z
      .enum(SCENE_AUDIO_UPLOAD_CONTENT_TYPES)
      .refine((value) => input.allowedTypes.includes(value), {
        message: "Unsupported recording type.",
      }),
    fileName: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive().max(input.maximumBytes),
  });
}

export function completeSceneAudioRecordingUploadSchema(input: {
  allowedTypes: string[];
  maximumBytes: number;
}) {
  return createSceneAudioRecordingUploadSchema(input)
    .omit({ fileName: true })
    .extend({
      generationId: z.uuid(),
      objectKey: z.string().min(1).max(512),
      durationMilliseconds: z
        .number()
        .int()
        .nonnegative()
        .max(30 * 60 * 1000),
    });
}

export type SceneAudioRecordingUploadInput = z.infer<
  ReturnType<typeof createSceneAudioRecordingUploadSchema>
>;
export type CompleteSceneAudioRecordingUploadInput = z.infer<
  ReturnType<typeof completeSceneAudioRecordingUploadSchema>
>;

export type VoicePresetInput = z.infer<typeof voicePresetInputSchema>;
export type StartSceneAudioGenerationInput = z.infer<
  typeof startSceneAudioGenerationSchema
>;
export type StartBulkSceneAudioGenerationInput = z.infer<
  typeof startBulkSceneAudioGenerationSchema
>;
export type SceneAudioFormat = z.infer<typeof audioFormatSchema>;
