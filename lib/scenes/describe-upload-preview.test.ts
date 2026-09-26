import { describe, expect, it } from "vitest";
import { isSceneImageUploadAspectRatioAllowed } from "@/lib/domain/scene-image";
import { describeUploadPreview } from "@/lib/scenes/describe-upload-preview";

describe("describeUploadPreview", () => {
  it("says nothing is lost when the shape already matches", () => {
    const preview = describeUploadPreview({
      width: 3072,
      height: 2048,
      targetSize: "1536x1024",
    });
    expect(preview.verdict).toBe("fits");
    expect(preview.trimmedPerEdgePercent).toBe(0);
    expect(preview.message).toContain("Nothing will be cropped");
  });

  // The part a creator cannot see coming: accepted, then quietly loses its
  // edges at render time.
  it("warns that a widescreen upload loses its sides", () => {
    const preview = describeUploadPreview({
      width: 1920,
      height: 1080,
      targetSize: "1536x1024",
    });
    expect(preview.verdict).toBe("cropped");
    expect(preview.trimmedPerEdgePercent).toBeGreaterThan(0);
    expect(preview.message).toContain("each side");
  });

  it("warns that a too-tall upload loses its top and bottom", () => {
    const preview = describeUploadPreview({
      width: 1600,
      height: 1200,
      targetSize: "1536x1024",
    });
    expect(preview.verdict).toBe("cropped");
    expect(preview.message).toContain("top and bottom");
  });

  it("points at where the crop can be moved, rather than only reporting it", () => {
    expect(
      describeUploadPreview({
        width: 1920,
        height: 1080,
        targetSize: "1536x1024",
      }).message,
    ).toContain("framing editor");
  });

  it("refuses a shape the upload would refuse, with the same numbers", () => {
    const preview = describeUploadPreview({
      width: 1920,
      height: 1080,
      targetSize: "1024x1024",
    });
    expect(preview.verdict).toBe("refused");
    expect(preview.message).toContain("78% off");
  });

  it("does not pretend to judge a file it could not measure", () => {
    for (const size of [
      { width: 0, height: 100 },
      { width: 100, height: 0 },
      { width: -5, height: 100 },
    ])
      expect(
        describeUploadPreview({ ...size, targetSize: "1024x1024" }).verdict,
      ).toBe("refused");
  });

  // The preview must agree with the upload, or it teaches the wrong thing: a
  // file shown as fine and then refused is worse than no preview at all.
  it("agrees with the guard across a spread of real shapes", () => {
    const cases = [
      { width: 1920, height: 1080, targetSize: "1536x1024" as const },
      { width: 1600, height: 1200, targetSize: "1536x1024" as const },
      { width: 1080, height: 1920, targetSize: "1024x1536" as const },
      { width: 1920, height: 1080, targetSize: "1024x1024" as const },
      { width: 2560, height: 1080, targetSize: "1536x1024" as const },
      { width: 1024, height: 1024, targetSize: "1024x1024" as const },
    ];
    for (const one of cases) {
      const preview = describeUploadPreview(one);
      // Compared against the guard itself, not a restatement of its threshold,
      // so the two cannot drift apart when the tolerance is next adjusted.
      expect(preview.verdict !== "refused").toBe(
        isSceneImageUploadAspectRatioAllowed(one),
      );
    }
  });
});
