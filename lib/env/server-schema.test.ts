import { describe, expect, it } from "vitest";
import {
  parseServerEnvironment,
  storageEnvironmentSchema,
  projectEnvironmentSchema,
  characterEnvironmentSchema,
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
      DEFAULT_PROJECT_BUDGET_CENTS: 200,
    });
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
