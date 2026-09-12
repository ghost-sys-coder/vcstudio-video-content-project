import { describe, expect, it } from "vitest";
import {
  describeCoverCrop,
  formatBpsPercent,
  measureCoverCrop,
} from "@/lib/render/frame-geometry";

describe("the crop the image provider's sizes force on us", () => {
  it("measures what a 9:16 render takes off a portrait still", () => {
    // The provider's portrait size is 2:3 and we render 9:16. This is the
    // defect that cut the sides off every reframed video.
    const geometry = measureCoverCrop({
      imageWidth: 1024,
      imageHeight: 1536,
      frameWidth: 1080,
      frameHeight: 1920,
    });
    expect(geometry.matchesFrame).toBe(false);
    expect(geometry.croppedAxis).toBe("width");
    expect(geometry.visibleWidthBps).toBe(8438);
    expect(geometry.trimmedPerEdgeBps).toBe(781);
  });

  it("measures what a 16:9 render takes off a landscape still", () => {
    // The same defect, turned ninety degrees, and present in every landscape
    // render the tool has ever produced.
    const geometry = measureCoverCrop({
      imageWidth: 1536,
      imageHeight: 1024,
      frameWidth: 1920,
      frameHeight: 1080,
    });
    expect(geometry.croppedAxis).toBe("height");
    expect(geometry.visibleHeightBps).toBe(8438);
    expect(geometry.trimmedPerEdgeBps).toBe(781);
  });

  it("finds nothing to trim on a square render", () => {
    // 1024x1024 into 1080x1080 is the one case the provider gets exactly right.
    const geometry = measureCoverCrop({
      imageWidth: 1024,
      imageHeight: 1024,
      frameWidth: 1080,
      frameHeight: 1080,
    });
    expect(geometry.matchesFrame).toBe(true);
    expect(geometry.trimmedPerEdgeBps).toBe(0);
  });

  it("treats a differently sized image of the same shape as no crop", () => {
    // Scale is not the question. 1920x1080 and 1280x720 are one picture.
    expect(
      measureCoverCrop({
        imageWidth: 1280,
        imageHeight: 720,
        frameWidth: 1920,
        frameHeight: 1080,
      }).matchesFrame,
    ).toBe(true);
  });
});

describe("refusing to guess", () => {
  it("claims no crop when the image dimensions are unknown", () => {
    // An unrecorded size must not become a confident warning about a loss we
    // cannot substantiate.
    expect(
      measureCoverCrop({
        imageWidth: null,
        imageHeight: null,
        frameWidth: 1080,
        frameHeight: 1920,
      }).matchesFrame,
    ).toBe(true);
  });

  it("survives a zero dimension without dividing by it", () => {
    const geometry = measureCoverCrop({
      imageWidth: 0,
      imageHeight: 1536,
      frameWidth: 1080,
      frameHeight: 1920,
    });
    expect(geometry.matchesFrame).toBe(true);
    expect(Number.isNaN(geometry.visibleWidthBps)).toBe(false);
  });
});

describe("saying it in words", () => {
  it("says nothing at all when nothing is trimmed", () => {
    // A warning that always fires is one nobody reads.
    expect(
      describeCoverCrop(
        measureCoverCrop({
          imageWidth: 1024,
          imageHeight: 1024,
          frameWidth: 1080,
          frameHeight: 1080,
        }),
      ),
    ).toBeNull();
  });

  it("names the sides for a vertical render", () => {
    const sentence = describeCoverCrop(
      measureCoverCrop({
        imageWidth: 1024,
        imageHeight: 1536,
        frameWidth: 1080,
        frameHeight: 1920,
      }),
    );
    expect(sentence).toContain("each side");
    expect(sentence).toContain("7.8%");
  });

  it("names the top and bottom for a landscape render", () => {
    const sentence = describeCoverCrop(
      measureCoverCrop({
        imageWidth: 1536,
        imageHeight: 1024,
        frameWidth: 1920,
        frameHeight: 1080,
      }),
    );
    expect(sentence).toContain("top and bottom");
  });

  it("writes whole percentages without a trailing zero", () => {
    expect(formatBpsPercent(1000)).toBe("10%");
    expect(formatBpsPercent(781)).toBe("7.8%");
  });
});
