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

export const sceneMediaUploadEnvironmentSchema = z.object({
  MAX_SCENE_IMAGE_UPLOAD_SIZE_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(20 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  ALLOWED_SCENE_IMAGE_UPLOAD_MIME_TYPES: z
    .string()
    .default("image/png,image/jpeg,image/webp")
    .transform((value) => value.split(",").map((item) => item.trim()))
    .pipe(z.array(z.enum(["image/png", "image/jpeg", "image/webp"])).min(1)),
  MAX_SCENE_AUDIO_UPLOAD_SIZE_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(20 * 1024 * 1024)
    .default(15 * 1024 * 1024),
  ALLOWED_SCENE_AUDIO_UPLOAD_MIME_TYPES: z
    .string()
    .default("audio/webm,audio/mp4")
    .transform((value) => value.split(",").map((item) => item.trim()))
    .pipe(z.array(z.enum(["audio/webm", "audio/mp4"])).min(1)),
});

/**
 * Ceilings for the workspace media library. Kept separate from the scene upload
 * group because these are much larger — a library video is a finished asset for
 * a social post, not a per-scene clip — and because the library is workspace
 * scoped rather than project scoped.
 */
export const mediaLibraryEnvironmentSchema = z.object({
  MAX_MEDIA_IMAGE_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(25 * 1024 * 1024),
  MAX_MEDIA_VIDEO_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(4 * 1024 * 1024 * 1024)
    .default(512 * 1024 * 1024),
  /**
   * Advisory ceiling on a library video's client-reported duration. The web
   * runtime has no ffprobe, so this rejects obvious nonsense early; every
   * platform still enforces its own limit at publish time.
   */
  MAX_MEDIA_VIDEO_DURATION_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 60 * 60)
    .default(60 * 60),
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
  MAX_IDEAS_PER_BATCH: z.coerce.number().int().min(1).max(20).default(5),
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
  // Sits alongside FFPROBE_PATH because the same task uses both: ffprobe for
  // the clip's duration, ffmpeg to decode it into the amplitude envelope that
  // drives animated lip-sync. Worker-only.
  FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
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
  // Per-platform app credentials are OPTIONAL at the schema level so a platform
  // that isn't configured yet cannot fail validation for the whole publishing
  // subsystem (a missing TikTok key must not break YouTube/Instagram). Each
  // platform's credentials are validated lazily in `createVideoPublishProvider`
  // only when that platform is actually used — see `PlatformNotConfiguredError`.
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
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
  /** TikTok OAuth client — used by the worker to rotate user tokens. */
  TIKTOK_API_CLIENT_KEY: z.string().optional(),
  TIKTOK_API_CLIENT_SECRET: z.string().optional(),
  /**
   * LinkedIn OAuth client. Optional like the others so a workspace without a
   * LinkedIn app cannot break Facebook or YouTube publishing; validated lazily
   * in `createSocialPostProvider`.
   */
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  /**
   * Versioned REST API date, e.g. `202607`. LinkedIn requires this header.
   *
   * LinkedIn retires versions on a rolling ~1 year schedule and a retired value
   * fails **every** request with `426 NONEXISTENT_VERSION` — it is not a
   * deprecation warning. This default therefore needs periodic review; see the
   * README's LinkedIn setup notes.
   */
  LINKEDIN_API_VERSION: z
    .string()
    .regex(/^\d{6}$/, "LINKEDIN_API_VERSION must look like 202607")
    .default("202607"),
  /**
   * X (Twitter) OAuth 2.0 client. Optional for the same reason as the others.
   *
   * Named `TWITTER_*` to match what the platform's own developer portal, token
   * endpoints, and stored `content_platform` value still call it — only the
   * user-facing label is "X".
   *
   * Read in **both** runtimes: the web app for the connect flow, and the worker
   * to rotate access tokens, which X expires after roughly two hours. A worker
   * missing these cannot refresh, and every scheduled X post fails once the
   * first token lapses.
   */
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  ENABLE_VIDEO_PUBLISHING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /**
   * Testing/demo switch. When true, every platform is served by a simulator
   * that ramps upload progress and returns a synthetic success WITHOUT calling
   * any real platform API — so the end-to-end publish flow can be exercised
   * without live accounts, tokens, or a publicly reachable video. Must be off in
   * production (a "published" video would never actually exist).
   */
  ENABLE_PUBLISH_SIMULATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /** Per-step delay of the simulated upload ramp, in milliseconds. */
  PUBLISH_SIMULATION_STEP_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(600),
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
  ENABLE_SOCIAL_POSTING: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /**
   * Same purpose as `ENABLE_PUBLISH_SIMULATION`, for social posts: every
   * platform is served by a simulator that returns a synthetic success without
   * touching a real API. It exists because LinkedIn posting needs an approved
   * app, which would otherwise block verifying the scheduler and the per-target
   * state machine. Must be false in production.
   */
  ENABLE_SOCIAL_POST_SIMULATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * TTL for the signed media URLs handed to a platform. Must exceed the publish
   * task's wall clock — Meta fetches image URLs itself, so a URL that expires
   * mid-job fails the post (the same trap that stalled long renders).
   */
  SOCIAL_POST_ASSET_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(600)
    .max(3600)
    .default(3600),
  /** How many due posts one scheduler sweep claims. */
  SOCIAL_SCHEDULER_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(25),
});

/**
 * Marketing Studio. Read in both runtimes: the web app gates routes and the
 * worker gates its scheduled sweeps, and a flag honoured in only one of them is
 * not a flag.
 *
 * Slice 0 defines the flag alone. The generation, research, and scheduling
 * variables in `docs/marketing/07-cost-governance.md` land with the slices that
 * first read them, so an unset variable never sits in the schema pretending a
 * feature exists.
 */
export const marketingEnvironmentSchema = z.object({
  ENABLE_MARKETING_STUDIO: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * The corpus ceiling. Also the documented threshold at which a vector store
   * stops being over-engineering — see docs/marketing/02-brand-grounding.md.
   */
  MARKETING_MAX_DOCUMENTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(2000)
    .default(200),
  /** 2 MB of plain text is roughly 500k tokens — far past any context budget. */
  MARKETING_MAX_DOCUMENT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(20_971_520)
    .default(2_097_152),
  /**
   * Ceiling for the compiled brand context block.
   *
   * Documents are dropped to fit, lowest priority first, and the block says how
   * many were omitted. Identity, voice, banned phrases and compliance notes are
   * never dropped, so this bounds the corpus rather than the constraints.
   */
  MARKETING_BRAND_CONTEXT_MAX_TOKENS: z.coerce
    .number()
    .int()
    .min(500)
    .max(50_000)
    .default(2_500),
  /**
   * The chat model. Separate from `OPENAI_TEXT_MODEL` because the two answer to
   * different pressures: scene analysis wants the strongest structured-output
   * model available, while a conversation is judged on latency as much as
   * quality and is billed per turn rather than per project.
   */
  MARKETING_CHAT_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  /**
   * Chat pricing, separate from `OPENAI_TEXT_*` for one reason: the two
   * variables above let the chat run on a different model, and a ledger that
   * records spend at another model's rates is a ledger that quietly stops
   * adding up. They default to the text model's rates so an unset deployment
   * records something plausible rather than zero — but if
   * `MARKETING_CHAT_MODEL` is changed, these must change with it.
   */
  MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(100),
  MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .default(600),
  /**
   * How many model steps one turn may take. A step is a model call plus any
   * tool calls it makes, so this bounds a tool loop rather than the answer.
   */
  MARKETING_CHAT_MAX_STEPS: z.coerce.number().int().min(1).max(20).default(6),
  /**
   * Per-turn spend ceiling. Crossing it drops the billable tools from the next
   * step, so the model must summarise what it has and stop.
   *
   * A step limit alone does not bound cost — six image generations sit
   * comfortably inside six steps. This is the ceiling that actually holds.
   */
  MARKETING_CHAT_MAX_TURN_COST_CENTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000)
    .default(25),
  /**
   * How many prior turns are replayed to the model.
   *
   * Bounded because history is reloaded in full on every turn, so an
   * unbounded thread would grow its own input cost without limit — a long
   * conversation would quietly get more expensive per message.
   */
  MARKETING_CHAT_HISTORY_MESSAGES: z.coerce
    .number()
    .int()
    .min(2)
    .max(200)
    .default(40),
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
  /**
   * Marketing chat gets its own ceiling. A conversation is chatty by nature, so
   * sharing the generation limit would make ordinary use look like abuse.
   */
  RATE_LIMIT_MARKETING_CHAT_PER_WINDOW: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(20),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;
export type ClerkWebhookEnvironment = z.infer<
  typeof clerkWebhookEnvironmentSchema
>;
export type StorageEnvironment = z.infer<typeof storageEnvironmentSchema>;
export type CharacterEnvironment = z.infer<typeof characterEnvironmentSchema>;
export type SceneMediaUploadEnvironment = z.infer<
  typeof sceneMediaUploadEnvironmentSchema
>;
export type MediaLibraryEnvironment = z.infer<
  typeof mediaLibraryEnvironmentSchema
>;
export type ProjectEnvironment = z.infer<typeof projectEnvironmentSchema>;
export type SceneAnalysisEnvironment = z.infer<
  typeof sceneAnalysisEnvironmentSchema
>;
export type SceneImageEnvironment = z.infer<typeof sceneImageEnvironmentSchema>;
export type MarketingEnvironment = z.infer<typeof marketingEnvironmentSchema>;
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
