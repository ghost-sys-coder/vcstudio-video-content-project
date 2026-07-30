import { describe, expect, it } from "vitest";
import { checkMediaUpload } from "@/lib/media/media-upload-limits";

const limits = {
  maxImageBytes: 25 * 1024 * 1024,
  maxVideoBytes: 512 * 1024 * 1024,
  maxVideoDurationSeconds: 3600,
};

describe("checkMediaUpload", () => {
  it("allows an image inside the ceiling", () => {
    expect(
      checkMediaUpload({
        kind: "image",
        sizeBytes: 1024,
        durationMilliseconds: null,
        limits,
      }),
    ).toEqual({ allowed: true });
  });

  it("applies the image ceiling to images and the video ceiling to videos", () => {
    const oversizedForAnImage = 30 * 1024 * 1024;
    const image = checkMediaUpload({
      kind: "image",
      sizeBytes: oversizedForAnImage,
      durationMilliseconds: null,
      limits,
    });
    expect(image.allowed).toBe(false);
    if (!image.allowed) expect(image.reason).toContain("25 MB");

    // The same byte count is perfectly fine for a video.
    expect(
      checkMediaUpload({
        kind: "video",
        sizeBytes: oversizedForAnImage,
        durationMilliseconds: null,
        limits,
      }),
    ).toEqual({ allowed: true });
  });

  it("rejects an empty or non-integer size", () => {
    expect(
      checkMediaUpload({
        kind: "image",
        sizeBytes: 0,
        durationMilliseconds: null,
        limits,
      }).allowed,
    ).toBe(false);
    expect(
      checkMediaUpload({
        kind: "image",
        sizeBytes: 1.5,
        durationMilliseconds: null,
        limits,
      }).allowed,
    ).toBe(false);
  });

  it("rejects a video longer than the duration ceiling", () => {
    const result = checkMediaUpload({
      kind: "video",
      sizeBytes: 1024,
      durationMilliseconds: 3601 * 1000,
      limits,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("60 minute");
  });

  it("accepts a video whose duration could not be measured", () => {
    // The browser is the only thing that can measure duration in the web
    // runtime, so an unmeasurable file must not be treated as a violation.
    expect(
      checkMediaUpload({
        kind: "video",
        sizeBytes: 1024,
        durationMilliseconds: null,
        limits,
      }),
    ).toEqual({ allowed: true });
  });

  it("ignores duration for images entirely", () => {
    expect(
      checkMediaUpload({
        kind: "image",
        sizeBytes: 1024,
        durationMilliseconds: 999_999_999,
        limits,
      }),
    ).toEqual({ allowed: true });
  });
});
