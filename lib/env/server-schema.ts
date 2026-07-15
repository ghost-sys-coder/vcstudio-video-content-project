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

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;
export type ClerkWebhookEnvironment = z.infer<
  typeof clerkWebhookEnvironmentSchema
>;
export type StorageEnvironment = z.infer<typeof storageEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
