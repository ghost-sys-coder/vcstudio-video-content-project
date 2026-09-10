import { describe, expect, it } from "vitest";
import {
  checkThumbnailUploadFit,
  describeAspectRatio,
  describeThumbnailUploadTarget,
} from "@/lib/thumbnails/thumbnail-upload-fit";

const LANDSCAPE = ["youtube", "facebook"] as const;
const PORTRAIT = ["tiktok", "instagram"] as const;

describe("the shapes creators actually have are accepted", () => {
  it("accepts a standard 16:9 thumbnail, which used to be rejected", () => {
    // The defect this fixes. 1280x720 is 18.5% away from the 3:2 the image
    // model produces, so the old check refused every correctly sized YouTube
    // thumbnail.
    for (const platform of LANDSCAPE)
      expect(
        checkThumbnailUploadFit({ platform, width: 1280, height: 720 }).fits,
      ).toBe(true);
  });

  it("accepts a standard 9:16 cover, which used to be rejected", () => {
    for (const platform of PORTRAIT)
      expect(
        checkThumbnailUploadFit({ platform, width: 1080, height: 1920 }).fits,
      ).toBe(true);
  });

  it("still accepts the shape this app generates, so a re-upload works", () => {
    // A creator can download a generated thumbnail, retouch it, and put it
    // back. That must not fail.
    expect(
      checkThumbnailUploadFit({
        platform: "youtube",
        width: 1536,
        height: 1024,
      }).fits,
    ).toBe(true);
    expect(
      checkThumbnailUploadFit({ platform: "tiktok", width: 1024, height: 1536 })
        .fits,
    ).toBe(true);
  });

  it("accepts the ends of the band, including rounding", () => {
    // 1366x768 reads as 16:9 but is a hair over it in integer arithmetic.
    expect(
      checkThumbnailUploadFit({ platform: "youtube", width: 1366, height: 768 })
        .fits,
    ).toBe(true);
    expect(
      checkThumbnailUploadFit({ platform: "youtube", width: 1024, height: 768 })
        .fits,
    ).toBe(true);
  });
});

describe("a genuinely wrong shape is still refused", () => {
  it("refuses a square", () => {
    expect(
      checkThumbnailUploadFit({
        platform: "youtube",
        width: 1024,
        height: 1024,
      }).fits,
    ).toBe(false);
  });

  it("refuses a portrait image for a landscape platform, and says so", () => {
    const result = checkThumbnailUploadFit({
      platform: "youtube",
      width: 1080,
      height: 1920,
    });
    expect(result.fits).toBe(false);
    if (result.fits) return;
    expect(result.message).toContain("This image is portrait");
    expect(result.message).toContain("landscape thumbnail is needed");
  });

  it("refuses a landscape image for a portrait platform", () => {
    const result = checkThumbnailUploadFit({
      platform: "tiktok",
      width: 1920,
      height: 1080,
    });
    expect(result.fits).toBe(false);
  });

  it("refuses dimensions that could not be read", () => {
    for (const size of [
      { width: 0, height: 100 },
      { width: 100, height: 0 },
      { width: Number.NaN, height: 100 },
    ])
      expect(
        checkThumbnailUploadFit({ platform: "youtube", ...size }).fits,
      ).toBe(false);
  });
});

describe("a refusal says what to do about it", () => {
  const rejected = checkThumbnailUploadFit({
    platform: "youtube",
    width: 1024,
    height: 1024,
  });

  it("names what the image is", () => {
    expect(rejected.fits).toBe(false);
    if (rejected.fits) return;
    expect(rejected.message).toContain("1024 × 1024");
    expect(rejected.message).toContain("1:1");
  });

  it("names the shape that is needed and a size to aim for", () => {
    if (rejected.fits) return;
    expect(rejected.message).toContain("4:3 to 16:9");
    expect(rejected.message).toContain("1280 × 720");
  });

  it("never falls back to the wording that told a creator nothing", () => {
    if (rejected.fits) return;
    expect(rejected.message).not.toContain("closely enough");
  });

  it("gives a vertical platform a vertical example", () => {
    const portrait = checkThumbnailUploadFit({
      platform: "instagram",
      width: 1024,
      height: 1024,
    });
    if (portrait.fits) return;
    expect(portrait.message).toContain("9:16 to 3:4");
    expect(portrait.message).toContain("1080 × 1920");
  });
});

describe("describeThumbnailUploadTarget", () => {
  it("previews at the shape the platform really displays", () => {
    // Not the 3:2 the image model produces: a creator should see the framing
    // they will actually get.
    expect(
      describeThumbnailUploadTarget("youtube").previewAspectRatio,
    ).toBeCloseTo(16 / 9, 5);
    expect(
      describeThumbnailUploadTarget("tiktok").previewAspectRatio,
    ).toBeCloseTo(9 / 16, 5);
  });

  it("knows which platforms are vertical", () => {
    for (const platform of LANDSCAPE)
      expect(describeThumbnailUploadTarget(platform).orientation).toBe(
        "landscape",
      );
    for (const platform of PORTRAIT)
      expect(describeThumbnailUploadTarget(platform).orientation).toBe(
        "portrait",
      );
  });
});

describe("describeAspectRatio", () => {
  it("reduces common shapes to recognisable labels", () => {
    expect(describeAspectRatio(1280, 720)).toBe("16:9");
    expect(describeAspectRatio(1024, 1024)).toBe("1:1");
    expect(describeAspectRatio(1536, 1024)).toBe("3:2");
  });

  it("falls back to a decimal when the reduction is unreadable", () => {
    // 1237:999 helps nobody.
    expect(describeAspectRatio(1237, 999)).toBe("1.24:1");
  });

  it("does not divide by zero", () => {
    expect(describeAspectRatio(0, 100)).toBe("unknown");
  });
});
