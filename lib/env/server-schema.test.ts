import { describe, expect, it } from "vitest";
import {
  parseServerEnvironment,
  storageEnvironmentSchema,
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
