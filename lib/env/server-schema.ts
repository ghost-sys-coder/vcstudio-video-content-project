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

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
