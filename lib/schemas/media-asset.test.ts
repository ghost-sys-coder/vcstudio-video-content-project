import { describe, expect, it } from "vitest";
import {
  completeMediaUploadSchema,
  MEDIA_ASSET_KIND_BY_CONTENT_TYPE,
  MEDIA_FILE_EXTENSION_BY_CONTENT_TYPE,
  requestMediaUploadSchema,
  sanitizeMediaFileName,
  updateMediaAssetSchema,
} from "@/lib/schemas/media-asset";

describe("sanitizeMediaFileName", () => {
  it("drops any directory prefix", () => {
    expect(sanitizeMediaFileName("C:\\Users\\me\\clip.mp4")).toBe("clip.mp4");
    expect(sanitizeMediaFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeMediaFileName("nested/folder/photo.png")).toBe("photo.png");
  });

  it("removes control characters", () => {
    const withControls = `pho${String.fromCodePoint(0)}to${String.fromCodePoint(31)}.png`;
    expect(sanitizeMediaFileName(withControls)).toBe("photo.png");
    expect(sanitizeMediaFileName(`x${String.fromCodePoint(127)}.png`)).toBe(
      "x.png",
    );
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeMediaFileName("  my   holiday   photo.png  ")).toBe(
      "my holiday photo.png",
    );
  });

  it("truncates absurdly long names", () => {
    expect(sanitizeMediaFileName(`${"a".repeat(400)}.png`)).toHaveLength(255);
  });
});

describe("content type maps", () => {
  it("classifies every accepted type and gives it an extension", () => {
    for (const contentType of Object.keys(
      MEDIA_ASSET_KIND_BY_CONTENT_TYPE,
    ) as (keyof typeof MEDIA_ASSET_KIND_BY_CONTENT_TYPE)[]) {
      expect(["image", "video"]).toContain(
        MEDIA_ASSET_KIND_BY_CONTENT_TYPE[contentType],
      );
      expect(MEDIA_FILE_EXTENSION_BY_CONTENT_TYPE[contentType]).toMatch(
        /^[a-z0-9]+$/,
      );
    }
  });
});

describe("requestMediaUploadSchema", () => {
  it("accepts a supported upload and sanitizes the file name", () => {
    const parsed = requestMediaUploadSchema.parse({
      contentType: "image/png",
      fileName: "photos/final draft.png",
      sizeBytes: 2048,
      durationMilliseconds: null,
    });
    expect(parsed.fileName).toBe("final draft.png");
    expect(parsed.durationMilliseconds).toBeNull();
  });

  it("defaults a missing duration to null rather than failing", () => {
    const parsed = requestMediaUploadSchema.parse({
      contentType: "video/mp4",
      fileName: "clip.mp4",
      sizeBytes: 2048,
    });
    expect(parsed.durationMilliseconds).toBeNull();
  });

  it("rejects a content type outside the allow-list", () => {
    expect(
      requestMediaUploadSchema.safeParse({
        contentType: "application/pdf",
        fileName: "report.pdf",
        sizeBytes: 2048,
      }).success,
    ).toBe(false);
    // SVG is deliberately excluded: it can carry script.
    expect(
      requestMediaUploadSchema.safeParse({
        contentType: "image/svg+xml",
        fileName: "logo.svg",
        sizeBytes: 2048,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(
      requestMediaUploadSchema.safeParse({
        contentType: "image/png",
        fileName: "empty.png",
        sizeBytes: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects a name that sanitizes away to nothing", () => {
    expect(
      requestMediaUploadSchema.safeParse({
        contentType: "image/png",
        fileName: "   ",
        sizeBytes: 2048,
      }).success,
    ).toBe(false);
  });
});

describe("completeMediaUploadSchema", () => {
  it("requires a uuid asset id", () => {
    expect(
      completeMediaUploadSchema.safeParse({
        mediaAssetId: "not-a-uuid",
        objectKey: "workspaces/a/library/b.png",
        contentType: "image/png",
        sizeBytes: 10,
      }).success,
    ).toBe(false);
  });
});

describe("updateMediaAssetSchema", () => {
  it("de-duplicates tags while preserving order", () => {
    const parsed = updateMediaAssetSchema.parse({
      mediaAssetId: "b3f1c1e2-0f5d-4a0b-9f1a-2c3d4e5f6a7b",
      title: "  Launch hero  ",
      altText: "A product on a desk",
      tags: ["launch", "hero", "launch"],
    });
    expect(parsed.tags).toEqual(["launch", "hero"]);
    expect(parsed.title).toBe("Launch hero");
  });

  it("rejects more tags than the ceiling allows", () => {
    expect(
      updateMediaAssetSchema.safeParse({
        mediaAssetId: "b3f1c1e2-0f5d-4a0b-9f1a-2c3d4e5f6a7b",
        title: "",
        altText: "",
        tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
      }).success,
    ).toBe(false);
  });
});
