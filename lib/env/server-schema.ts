import { z } from "zod";

export const serverEnvironmentSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_WEBHOOK_SIGNING_SECRET: z
    .string()
    .min(1, "CLERK_WEBHOOK_SIGNING_SECRET is required"),
  DATABASE_URL: z.url("DATABASE_URL must be a valid URL"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const databaseEnvironmentSchema = serverEnvironmentSchema.pick({
  DATABASE_URL: true,
  NODE_ENV: true,
});

export const clerkWebhookEnvironmentSchema = serverEnvironmentSchema.pick({
  CLERK_WEBHOOK_SIGNING_SECRET: true,
});

export const storageEnvironmentSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1, "R2_ACCOUNT_ID is required"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required"),
  R2_BUCKET_NAME: z.string().min(1, "R2_BUCKET_NAME is required"),
  R2_ENDPOINT: z.url("R2_ENDPOINT must be a valid URL"),
  R2_REGION: z.string().min(1).default("auto"),
  R2_SIGNED_UPLOAD_EXPIRY_SECONDS: z.coerce.number().int().min(60).max(900),
  R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS: z.coerce.number().int().min(60).max(3600),
});

export const characterEnvironmentSchema = z.object({
  MAX_CHARACTER_REFERENCE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(5 * 1024 * 1024),
  ALLOWED_IMAGE_MIME_TYPES: z
    .string()
    .transform((value) => value.split(",").map((item) => item.trim()))
    .pipe(z.array(z.enum(["image/png", "image/jpeg", "image/webp"])).min(1)),
  MIN_REFERENCE_IMAGE_WIDTH: z.coerce.number().int().min(1).max(4096),
  MIN_REFERENCE_IMAGE_HEIGHT: z.coerce.number().int().min(1).max(4096),
  MAX_REFERENCE_IMAGE_WIDTH: z.coerce.number().int().min(512).max(16384),
  MAX_REFERENCE_IMAGE_HEIGHT: z.coerce.number().int().min(512).max(16384),
  ENABLE_CHARACTER_LIBRARY: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});

export const projectEnvironmentSchema = z.object({
  MAX_SCRIPT_CHARACTERS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(250000)
    .default(50000),
  DEFAULT_PROJECT_BUDGET_CENTS: z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .default(200),
});

export const sceneAnalysisEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_TEXT_MODEL: z.string().min(1, "OPENAI_TEXT_MODEL is required"),
  OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS: z.coerce.number().int().positive(),
  OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS: z.coerce.number().int().positive(),
  OPENAI_REQUEST_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(600)
    .default(180),
  TRIGGER_SECRET_KEY: z.string().min(1, "TRIGGER_SECRET_KEY is required"),
  TRIGGER_PROJECT_REF: z.string().min(1, "TRIGGER_PROJECT_REF is required"),
  IDEMPOTENCY_HASH_SECRET: z.string().min(32),
  REQUEST_FINGERPRINT_SECRET: z.string().min(32),
  MAX_SCENES_PER_PROJECT: z.coerce.number().int().min(1).max(500).default(200),
  MIN_SCENE_DURATION_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(250)
    .default(1000),
  MAX_SCENE_DURATION_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(60000),
  MAX_SCENE_ANALYSIS_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  GENERATION_RESERVATION_EXPIRY_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(30),
  DEFAULT_DAILY_BUDGET_CENTS: z.coerce.number().int().positive().default(500),
  DEFAULT_MONTHLY_BUDGET_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
});

export const sceneImageEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_IMAGE_MODEL: z.string().min(1).default("gpt-image-2"),
  OPENAI_IMAGE_DRAFT_QUALITY: z.enum(["low"]).default("low"),
  OPENAI_IMAGE_FINAL_QUALITY: z.enum(["medium"]).default("medium"),
  OPENAI_IMAGE_OUTPUT_FORMAT: z.enum(["webp", "png", "jpeg"]).default("webp"),
  OPENAI_IMAGE_DRAFT_COMPRESSION: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(80),
  OPENAI_IMAGE_FINAL_COMPRESSION: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(90),
  OPENAI_IMAGE_BACKGROUND: z.enum(["opaque", "auto"]).default("opaque"),
  OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(500),
  OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(800),
  OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(3000),
  OPENAI_IMAGE_LOW_SQUARE_ESTIMATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(2),
  OPENAI_IMAGE_LOW_RECTANGULAR_ESTIMATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(2),
  OPENAI_IMAGE_MEDIUM_SQUARE_ESTIMATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(6),
  OPENAI_IMAGE_MEDIUM_RECTANGULAR_ESTIMATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(7),
  OPENAI_IMAGE_HIGH_SQUARE_ESTIMATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(20),
  OPENAI_IMAGE_HIGH_RECTANGULAR_ESTIMATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(25),
  OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(1),
  OPENAI_REQUEST_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(600)
    .default(180),
  TRIGGER_SECRET_KEY: z.string().min(1, "TRIGGER_SECRET_KEY is required"),
  TRIGGER_PROJECT_REF: z.string().min(1, "TRIGGER_PROJECT_REF is required"),
  IDEMPOTENCY_HASH_SECRET: z.string().min(32),
  REQUEST_FINGERPRINT_SECRET: z.string().min(32),
  MAX_IMAGE_GENERATION_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .max(2)
    .default(1),
  MAX_REFERENCE_ASSETS_PER_GENERATION: z.coerce
    .number()
    .int()
    .min(1)
    .max(16)
    .default(8),
  MAX_REFERENCE_BYTES_PER_GENERATION: z.coerce
    .number()
    .int()
    .min(1024)
    .max(50 * 1024 * 1024)
    .default(20 * 1024 * 1024),
  MAX_IMAGE_GENERATIONS_PER_SCENE_VERSION: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),
  MAX_IMAGES_PER_BATCH: z.coerce.number().int().min(1).max(100).default(25),
  GENERATION_RESERVATION_EXPIRY_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(30),
  DEFAULT_DAILY_BUDGET_CENTS: z.coerce.number().int().positive().default(500),
  DEFAULT_MONTHLY_BUDGET_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  ENABLE_SCENE_IMAGE_GENERATION: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export const sceneAudioEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_TTS_MODEL: z.string().min(1).default("gpt-4o-mini-tts"),
  OPENAI_TTS_VOICE: z.string().min(1).default("alloy"),
  OPENAI_TTS_FORMAT: z
    .enum(["mp3", "opus", "aac", "flac", "wav", "pcm"])
    .default("mp3"),
  OPENAI_TTS_SPEED_SCALED_PERCENT: z.coerce
    .number()
    .int()
    .min(25)
    .max(400)
    .default(100),
  OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(1500),
  OPENAI_TTS_MINIMUM_ESTIMATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(1),
  OPENAI_REQUEST_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(600)
    .default(180),
  TRIGGER_SECRET_KEY: z.string().min(1, "TRIGGER_SECRET_KEY is required"),
  TRIGGER_PROJECT_REF: z.string().min(1, "TRIGGER_PROJECT_REF is required"),
  IDEMPOTENCY_HASH_SECRET: z.string().min(32),
  REQUEST_FINGERPRINT_SECRET: z.string().min(32),
  MAX_AUDIO_GENERATION_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .max(2)
    .default(1),
  MAX_AUDIO_GENERATIONS_PER_SCENE_VERSION: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),
  MAX_SCENES_PER_AUDIO_BATCH: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25),
  MAX_NARRATION_CHARACTERS: z.coerce
    .number()
    .int()
    .min(1)
    .max(100_000)
    .default(4000),
  AUDIO_SCENE_PADDING_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(250),
  GENERATION_RESERVATION_EXPIRY_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(30),
  DEFAULT_DAILY_BUDGET_CENTS: z.coerce.number().int().positive().default(500),
  DEFAULT_MONTHLY_BUDGET_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  FFPROBE_PATH: z.string().min(1).default("ffprobe"),
  ENABLE_SCENE_AUDIO_GENERATION: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export const subtitleEnvironmentSchema = z.object({
  SUBTITLE_MAX_LINE_CHARACTERS: z.coerce
    .number()
    .int()
    .min(16)
    .max(120)
    .default(42),
  SUBTITLE_MIN_SEGMENT_DURATION_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(200)
    .max(10_000)
    .default(700),
  SUBTITLE_MAX_SEGMENT_DURATION_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30_000)
    .default(7000),
  SUBTITLE_DURATION_MISMATCH_TOLERANCE_MILLISECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(1500),
  ENABLE_SUBTITLES: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;
export type ClerkWebhookEnvironment = z.infer<
  typeof clerkWebhookEnvironmentSchema
>;
export type StorageEnvironment = z.infer<typeof storageEnvironmentSchema>;
export type CharacterEnvironment = z.infer<typeof characterEnvironmentSchema>;
export type ProjectEnvironment = z.infer<typeof projectEnvironmentSchema>;
export type SceneAnalysisEnvironment = z.infer<
  typeof sceneAnalysisEnvironmentSchema
>;
export type SceneImageEnvironment = z.infer<typeof sceneImageEnvironmentSchema>;
export type SceneAudioEnvironment = z.infer<typeof sceneAudioEnvironmentSchema>;
export type SubtitleEnvironment = z.infer<typeof subtitleEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
