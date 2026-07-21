import { describe, expect, it } from "vitest";
import {
  generateThumbnailSchema,
  getThumbnailSizeForPlatform,
  MAX_THUMBNAIL_HEADLINE_LENGTH,
} from "@/lib/schemas/thumbnail";

const projectId = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("getThumbnailSizeForPlatform", () => {
  it("uses vertical output for the vertical-first platforms", () => {
    expect(getThumbnailSizeForPlatform("tiktok")).toBe("1024x1536");
    expect(getThumbnailSizeForPlatform("instagram")).toBe("1024x1536");
  });

  it("uses landscape output for YouTube and Facebook", () => {
    expect(getThumbnailSizeForPlatform("youtube")).toBe("1536x1024");
    expect(getThumbnailSizeForPlatform("facebook")).toBe("1536x1024");
  });
});

describe("generateThumbnailSchema", () => {
  it("requires a headline when text is baked in", () => {
    const result = generateThumbnailSchema.safeParse({
      projectId,
      platform: "youtube",
      textMode: "baked",
      headlineText: "   ",
      requestNonce: "nonce-1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts baked mode with a headline", () => {
    const result = generateThumbnailSchema.safeParse({
      projectId,
      platform: "youtube",
      textMode: "baked",
      headlineText: "  IT WAS RUSTING  ",
      requestNonce: "nonce-1",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.headlineText).toBe("IT WAS RUSTING");
  });

  it("accepts clean mode without a headline", () => {
    const result = generateThumbnailSchema.safeParse({
      projectId,
      platform: "tiktok",
      textMode: "clean",
      requestNonce: "nonce-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an over-long headline", () => {
    const result = generateThumbnailSchema.safeParse({
      projectId,
      platform: "youtube",
      textMode: "baked",
      headlineText: "x".repeat(MAX_THUMBNAIL_HEADLINE_LENGTH + 1),
      requestNonce: "nonce-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown platform", () => {
    const result = generateThumbnailSchema.safeParse({
      projectId,
      platform: "threads",
      textMode: "clean",
      requestNonce: "nonce-1",
    });
    expect(result.success).toBe(false);
  });
});
