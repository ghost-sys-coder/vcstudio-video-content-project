/**
 * How much of an image survives being cover-fitted into a render frame.
 *
 * This exists because the image provider cannot produce the shapes we render
 * in. Its portrait size is 1024x1536, which is 2:3, and we render 9:16; its
 * landscape size is 1536x1024, which is 3:2, and we render 16:9. Neither
 * matches. The renderer cover-fits, so the difference is taken off the edges of
 * every still, silently, in every video.
 *
 * Before this module nothing in the codebase knew that. `resolveSceneImage`
 * called a 1024x1536 image "native" for a 9:16 render and applied identity
 * framing on the stated grounds that no crop was needed, the planner told
 * people their scenes already had an image "in this shape", and the outpaint
 * prompt named the frame size rather than the canvas the model would actually
 * return. Each of those is the same wrong belief, so the arithmetic lives in
 * one place that all of them can consult.
 */

/** A tenth of a percent. Below this, two aspect ratios are the same picture. */
const ASPECT_TOLERANCE = 0.001;

export interface CoverCropGeometry {
  /** True when the image needs no crop at all. */
  matchesFrame: boolean;
  /** Which axis loses pixels. */
  croppedAxis: "width" | "height" | "none";
  /** How much of the image's width survives, in basis points of 10000. */
  visibleWidthBps: number;
  /** How much of the image's height survives, in basis points of 10000. */
  visibleHeightBps: number;
  /**
   * How much is taken off each edge of the cropped axis, in basis points.
   * Half the total loss, because a centred cover crop trims both edges evenly.
   */
  trimmedPerEdgeBps: number;
}

const NONE: CoverCropGeometry = {
  matchesFrame: true,
  croppedAxis: "none",
  visibleWidthBps: 10_000,
  visibleHeightBps: 10_000,
  trimmedPerEdgeBps: 0,
};

/**
 * What a cover fit does to this image in this frame.
 *
 * Degenerate sizes return the no-crop answer rather than throwing: a missing
 * or zero dimension means we do not know, and claiming a specific loss we
 * cannot substantiate would be worse than claiming none.
 */
export function measureCoverCrop(input: {
  imageWidth: number | null;
  imageHeight: number | null;
  frameWidth: number;
  frameHeight: number;
}): CoverCropGeometry {
  const { imageWidth, imageHeight, frameWidth, frameHeight } = input;
  if (
    !imageWidth ||
    !imageHeight ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  )
    return NONE;

  const imageAspect = imageWidth / imageHeight;
  const frameAspect = frameWidth / frameHeight;
  if (Math.abs(imageAspect - frameAspect) <= ASPECT_TOLERANCE) return NONE;

  // Cover scales until both axes are covered, so the surviving fraction on the
  // cropped axis is the ratio of the aspects.
  if (imageAspect > frameAspect) {
    const visibleWidthBps = Math.round((frameAspect / imageAspect) * 10_000);
    return {
      matchesFrame: false,
      croppedAxis: "width",
      visibleWidthBps,
      visibleHeightBps: 10_000,
      trimmedPerEdgeBps: Math.round((10_000 - visibleWidthBps) / 2),
    };
  }

  const visibleHeightBps = Math.round((imageAspect / frameAspect) * 10_000);
  return {
    matchesFrame: false,
    croppedAxis: "height",
    visibleWidthBps: 10_000,
    visibleHeightBps,
    trimmedPerEdgeBps: Math.round((10_000 - visibleHeightBps) / 2),
  };
}

/** Basis points as a percentage string, for prose and for prompts. */
export function formatBpsPercent(bps: number): string {
  const percent = bps / 100;
  return Number.isInteger(percent)
    ? `${percent}%`
    : `${percent.toFixed(1).replace(/\.0$/, "")}%`;
}

/**
 * A sentence naming what a reframe will trim, or null when it trims nothing.
 *
 * Returned rather than rendered so the caller decides the tone. Null is the
 * important case: silence is correct when there is nothing to warn about, and
 * a warning that always fires is one nobody reads.
 */
export function describeCoverCrop(geometry: CoverCropGeometry): string | null {
  if (geometry.matchesFrame) return null;
  const edges =
    geometry.croppedAxis === "width" ? "each side" : "the top and bottom";
  return `About ${formatBpsPercent(geometry.trimmedPerEdgeBps)} of the picture is trimmed from ${edges}, because the image generator cannot produce this exact shape.`;
}
