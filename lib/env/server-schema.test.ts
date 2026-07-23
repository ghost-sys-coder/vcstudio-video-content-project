import { describe, expect, it } from "vitest";
import {
  parseServerEnvironment,
  storageEnvironmentSchema,
  projectEnvironmentSchema,
  characterEnvironmentSchema,
  sceneImageEnvironmentSchema,
  usageEnvironmentSchema,
  publishingEnvironmentSchema,
} from "@/lib/env/server-schema";

const validEnvironment = {
  CLERK_SECRET_KEY: "secret",
  CLERK_WEBHOOK_SIGNING_SECRET: "webhook-secret",
  DATABASE_URL: "postgresql://user:password@example.com/database",
  NODE_ENV: "test",
};

describe("server environment validation", () => {
  it("accepts the required Phase 1 server environment", () => {
    expect(parseServerEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: "test",
    });
  });

  it("rejects an empty Clerk webhook signing secret", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        CLERK_WEBHOOK_SIGNING_SECRET: "",
      }),
    ).toThrow();
  });
});

describe("character environment validation", () => {
  const values = {
    MAX_CHARACTER_REFERENCE_SIZE_BYTES: "5242880",
    ALLOWED_IMAGE_MIME_TYPES: "image/png,image/jpeg,image/webp",
    MIN_REFERENCE_IMAGE_WIDTH: "512",
    MIN_REFERENCE_IMAGE_HEIGHT: "512",
    MAX_REFERENCE_IMAGE_WIDTH: "4096",
    MAX_REFERENCE_IMAGE_HEIGHT: "4096",
    ENABLE_CHARACTER_LIBRARY: "true",
  };

  it("parses Phase 4 upload limits", () => {
    expect(characterEnvironmentSchema.parse(values)).toMatchObject({
      MAX_CHARACTER_REFERENCE_SIZE_BYTES: 5242880,
      ENABLE_CHARACTER_LIBRARY: true,
    });
  });

  it("rejects character references larger than five megabytes", () => {
    expect(() =>
      characterEnvironmentSchema.parse({
        ...values,
        MAX_CHARACTER_REFERENCE_SIZE_BYTES: String(5 * 1024 * 1024 + 1),
      }),
    ).toThrow();
  });
});

describe("project environment validation", () => {
  it("uses conservative Phase 2 defaults", () => {
    expect(projectEnvironmentSchema.parse({})).toEqual({
      MAX_SCRIPT_CHARACTERS: 50000,
      DEFAULT_PROJECT_BUDGET_CENTS: 500,
    });
  });
});

describe("usage environment validation", () => {
  it("uses the Phase 10 budget and confirmation defaults", () => {
    expect(usageEnvironmentSchema.parse({})).toEqual({
      DEFAULT_DAILY_BUDGET_CENTS: 500,
      DEFAULT_MONTHLY_BUDGET_CENTS: 5000,
      MANUAL_CONFIRMATION_THRESHOLD_CENTS: 100,
      RATE_LIMIT_WINDOW_SECONDS: 60,
      RATE_LIMIT_GENERATIONS_PER_WINDOW: 30,
      RATE_LIMIT_RENDERS_PER_WINDOW: 10,
    });
  });

  it("rejects a negative manual-confirmation threshold", () => {
    expect(() =>
      usageEnvironmentSchema.parse({
        MANUAL_CONFIRMATION_THRESHOLD_CENTS: "-1",
      }),
    ).toThrow();
  });
});

describe("storage environment validation", () => {
  it("parses a complete R2 configuration", () => {
    expect(
      storageEnvironmentSchema.parse({
        R2_ACCOUNT_ID: "account",
        R2_ACCESS_KEY_ID: "access",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET_NAME: "bucket",
        R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
        R2_REGION: "auto",
        R2_SIGNED_UPLOAD_EXPIRY_SECONDS: "300",
        R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS: "300",
      }).R2_SIGNED_UPLOAD_EXPIRY_SECONDS,
    ).toBe(300);
  });
});

describe("scene image environment validation", () => {
  const requiredValues = {
    OPENAI_API_KEY: "openai-secret",
    TRIGGER_SECRET_KEY: "trigger-secret",
    TRIGGER_PROJECT_REF: "proj_test",
    IDEMPOTENCY_HASH_SECRET: "i".repeat(32),
    REQUEST_FINGERPRINT_SECRET: "f".repeat(32),
  };

  it("uses the approved Phase 5 defaults", () => {
    expect(sceneImageEnvironmentSchema.parse(requiredValues)).toMatchObject({
      OPENAI_IMAGE_MODEL: "gpt-image-2",
      OPENAI_IMAGE_DRAFT_QUALITY: "low",
      OPENAI_IMAGE_FINAL_QUALITY: "medium",
      OPENAI_IMAGE_OUTPUT_FORMAT: "webp",
      OPENAI_IMAGE_DRAFT_COMPRESSION: 80,
      OPENAI_IMAGE_FINAL_COMPRESSION: 90,
      OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS: 500,
      OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS: 800,
      OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS: 3000,
      ENABLE_SCENE_IMAGE_GENERATION: true,
    });
  });

  it("rejects more references than the provider supports", () => {
    expect(() =>
      sceneImageEnvironmentSchema.parse({
        ...requiredValues,
        MAX_REFERENCE_ASSETS_PER_GENERATION: "17",
      }),
    ).toThrow();
  });
});

describe("publishing environment validation", () => {
  const base = {
    PLATFORM_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  };

  it("parses with NO platform app credentials set (a missing platform must not fail the whole subsystem)", () => {
    const result = publishingEnvironmentSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TIKTOK_API_CLIENT_KEY).toBeUndefined();
      expect(result.data.GOOGLE_OAUTH_CLIENT_ID).toBeUndefined();
      // Simulation defaults off so production is real by default.
      expect(result.data.ENABLE_PUBLISH_SIMULATION).toBe(false);
    }
  });

  it("still requires the token encryption key (needed by every platform)", () => {
    expect(publishingEnvironmentSchema.safeParse({}).success).toBe(false);
  });
});
