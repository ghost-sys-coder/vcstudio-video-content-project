import { z } from "zod";
import { decodeEncryptionKey } from "@/lib/crypto/secret-box";

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
    .default(500),
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

export const renderEnvironmentSchema = z.object({
  TRIGGER_SECRET_KEY: z.string().min(1, "TRIGGER_SECRET_KEY is required"),
  TRIGGER_PROJECT_REF: z.string().min(1, "TRIGGER_PROJECT_REF is required"),
  IDEMPOTENCY_HASH_SECRET: z.string().min(32),
  REQUEST_FINGERPRINT_SECRET: z.string().min(32),
  // Cost model for compute-time rendering. There is no per-render provider
  // invoice, so the estimate is derived from output duration at a configured
  // per-minute rate and reconciled to the same figure once the render lands.
  // Rendering is compute-only, so this rate is deliberately modest relative to
  // the genuinely-billable image/audio operations that draw on the same budget.
  VIDEO_RENDER_COST_PER_MINUTE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5),
  VIDEO_RENDER_MINIMUM_ESTIMATE_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5),
  MAX_RENDER_DURATION_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(7200)
    .default(900),
  MAX_RENDER_ATTEMPTS: z.coerce.number().int().min(0).max(3).default(2),
  VIDEO_RENDER_RESERVATION_EXPIRY_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(60),
  DEFAULT_DAILY_BUDGET_CENTS: z.coerce.number().int().positive().default(500),
  DEFAULT_MONTHLY_BUDGET_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  // Lifetime of the signed asset URLs handed to the in-browser preview player.
  // A full-length preview can play for many minutes and be replayed, so these
  // must outlive the whole session; the download/render paths keep their own
  // short-lived URLs. Signed in the web runtime, so this is a Vercel-side value.
  VIDEO_PREVIEW_URL_EXPIRY_SECONDS: z.coerce
    .number()
    .int()
    .min(900)
    .max(3600)
    .default(3600),
  // Worker-only rendering controls. They carry defaults so the web runtime,
  // which never renders, still parses cleanly without them configured.
  VIDEO_RENDER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  VIDEO_RENDER_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(7200)
    .default(1800),
  VIDEO_RENDER_CRF: z.coerce.number().int().min(1).max(51).default(18),
  VIDEO_RENDER_JPEG_QUALITY: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(80),
  REMOTION_CHROMIUM_EXECUTABLE: z.string().min(1).optional(),
  VIDEO_WATERMARK_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  VIDEO_WATERMARK_TEXT: z.string().default(""),
  ENABLE_VIDEO_RENDERING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

// Phase 10 usage/budget configuration read in the web runtime when it resolves
// a workspace's effective budgets and decides whether an estimate crosses the
// manual-confirmation threshold. The daily/monthly defaults mirror the other
// budget-bearing groups (they seed a workspace's editable settings row); the
// threshold is a Vercel-only preflight/UX value that no worker reads.
// Publishing a finished render to an external platform. Deliberately grouped
// per-platform-agnostic values first, then the YouTube (Google OAuth) client, so
// adding Facebook/Instagram/TikTok later means adding their own client block
// without touching the shared pieces.
export const publishingEnvironmentSchema = z.object({
  /** 32 bytes, base64 or hex. Encrypts platform OAuth tokens at rest. */
  PLATFORM_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(1, "PLATFORM_TOKEN_ENCRYPTION_KEY is required")
    .superRefine((value, context) => {
      try {
        decodeEncryptionKey(value);
      } catch {
        context.addIssue({
          code: "custom",
          message:
            "PLATFORM_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64 or hex).",
        });
      }
    }),
  GOOGLE_OAUTH_CLIENT_ID: z
    .string()
    .min(1, "GOOGLE_OAUTH_CLIENT_ID is required"),
  GOOGLE_OAUTH_CLIENT_SECRET: z
    .string()
    .min(1, "GOOGLE_OAUTH_CLIENT_SECRET is required"),
  /** Versioned Graph API path shared by the web OAuth flow and publish worker. */
  FACEBOOK_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/, "FACEBOOK_GRAPH_API_VERSION must look like v25.0")
    .default("v25.0"),
  /** Instagram Graph version shared by OAuth profile calls and the worker. */
  INSTAGRAM_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/, "INSTAGRAM_GRAPH_API_VERSION must look like v25.0")
    .default("v25.0"),
  ENABLE_VIDEO_PUBLISHING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /** Hard ceiling on the upload payload, independent of what a render produced. */
  MAX_PUBLISH_VIDEO_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(1_073_741_824),
  /** Must exceed the publish task's wall clock, or the download URL dies mid-upload. */
  PUBLISH_ASSET_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(600)
    .max(3600)
    .default(3600),
});

/**
 * OAuth values only the **web runtime** needs: the Trigger.dev worker never
 * mints or verifies an authorization `state`, and never builds a redirect URI.
 * Kept separate so the state-signing secret is not shipped to a second runtime
 * that has no use for it.
 */
export const publishingWebEnvironmentSchema = z.object({
  /** Public origin used to build OAuth redirect URIs; must match the client's registered URI. */
  APP_BASE_URL: z.url("APP_BASE_URL must be a valid URL"),
  /** Signs the OAuth `state` parameter so a callback cannot be forged or replayed. */
  OAUTH_STATE_SECRET: z
    .string()
    .min(32, "OAUTH_STATE_SECRET must be at least 32 characters"),
  OAUTH_STATE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(600),
  /** Meta app credentials are web-only; Trigger.dev receives Page tokens instead. */
  FACEBOOK_APP_ID: z.string().min(1, "FACEBOOK_APP_ID is required"),
  FACEBOOK_APP_SECRET: z.string().min(1, "FACEBOOK_APP_SECRET is required"),
  /** Direct Instagram Login credentials; no Facebook Page is required. */
  INSTAGRAM_APP_ID: z.string().min(1, "INSTAGRAM_APP_ID is required"),
  INSTAGRAM_APP_SECRET: z.string().min(1, "INSTAGRAM_APP_SECRET is required"),
});

export const usageEnvironmentSchema = z.object({
  DEFAULT_DAILY_BUDGET_CENTS: z.coerce.number().int().positive().default(500),
  DEFAULT_MONTHLY_BUDGET_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),
  MANUAL_CONFIRMATION_THRESHOLD_CENTS: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(100000)
    .default(100),
  // Fixed-window rate limiting for billable/mutating operations. Enforced in the
  // web runtime before a reservation is created, so these are Vercel-only.
  RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3600)
    .default(60),
  RATE_LIMIT_GENERATIONS_PER_WINDOW: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(30),
  RATE_LIMIT_RENDERS_PER_WINDOW: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(10),
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
export type PublishingEnvironment = z.infer<typeof publishingEnvironmentSchema>;
export type PublishingWebEnvironment = z.infer<
  typeof publishingWebEnvironmentSchema
>;
export type SceneAudioEnvironment = z.infer<typeof sceneAudioEnvironmentSchema>;
export type SubtitleEnvironment = z.infer<typeof subtitleEnvironmentSchema>;
export type RenderEnvironment = z.infer<typeof renderEnvironmentSchema>;
export type UsageEnvironment = z.infer<typeof usageEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
