import { describe, expect, it } from "vitest";
import {
  completeThumbnailUploadSchema,
  createThumbnailUploadSchema,
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

const uploadLimits = {
  allowedTypes: ["image/png", "image/jpeg"],
  maximumBytes: 5_000_000,
};

const upload = {
  platform: "youtube" as const,
  contentType: "image/png" as const,
  fileName: "cover.png",
  sizeBytes: 400_000,
};

describe("createThumbnailUploadSchema", () => {
  it("accepts an allowed image within the size limit", () => {
    expect(
      createThumbnailUploadSchema(uploadLimits).safeParse(upload).success,
    ).toBe(true);
  });

  it("rejects a type the deployment does not allow, even a real image type", () => {
    // The allow-list is configuration, so a supported-looking type still has to
    // clear it rather than being waved through by the enum alone.
    expect(
      createThumbnailUploadSchema(uploadLimits).safeParse({
        ...upload,
        contentType: "image/webp",
      }).success,
    ).toBe(false);
  });

  it("rejects a file larger than the configured maximum", () => {
    expect(
      createThumbnailUploadSchema(uploadLimits).safeParse({
        ...upload,
        sizeBytes: uploadLimits.maximumBytes + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-image type outright", () => {
    expect(
      createThumbnailUploadSchema({
        ...uploadLimits,
        allowedTypes: ["application/pdf"],
      }).safeParse({ ...upload, contentType: "application/pdf" }).success,
    ).toBe(false);
  });

  it("rejects an empty or oversized file name", () => {
    for (const fileName of ["", "   ", "x".repeat(256)])
      expect(
        createThumbnailUploadSchema(uploadLimits).safeParse({
          ...upload,
          fileName,
        }).success,
      ).toBe(false);
  });

  it("rejects a zero or negative byte length", () => {
    for (const sizeBytes of [0, -1])
      expect(
        createThumbnailUploadSchema(uploadLimits).safeParse({
          ...upload,
          sizeBytes,
        }).success,
      ).toBe(false);
  });
});

describe("completeThumbnailUploadSchema", () => {
  const completion = {
    platform: "youtube" as const,
    contentType: "image/png" as const,
    sizeBytes: 400_000,
    thumbnailGenerationId: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    objectKey: "workspaces/w/projects/p/thumbnails/youtube/t.png",
  };

  it("accepts a finalization that names the object it authorized", () => {
    expect(
      completeThumbnailUploadSchema(uploadLimits).safeParse(completion).success,
    ).toBe(true);
  });

  it("does not ask for the file name a second time", () => {
    // The name is only needed to authorize the upload; re-sending it would give
    // the browser a second chance to influence what gets stored.
    const parsed =
      completeThumbnailUploadSchema(uploadLimits).safeParse(completion);
    expect(parsed.success && "fileName" in parsed.data).toBe(false);
  });

  it("requires a real generation id and object key", () => {
    for (const override of [
      { thumbnailGenerationId: "not-a-uuid" },
      { objectKey: "" },
      { objectKey: "x".repeat(513) },
    ])
      expect(
        completeThumbnailUploadSchema(uploadLimits).safeParse({
          ...completion,
          ...override,
        }).success,
      ).toBe(false);
  });
});
