import "server-only";

import sharp from "sharp";

/**
 * Alpha-channel inspection for stored images.
 *
 * Character pose stills are requested with a transparent background, but the
 * request is not proof: the model can return a fully painted frame in an
 * alpha-capable container, and the stored content type says nothing about
 * whether any pixel is actually transparent. This decodes the image and
 * measures it.
 */

/**
 * Edge length the image is sampled at. Alpha coverage is a proportion, so a
 * small grid answers it accurately while keeping a 1024px still cheap enough to
 * inspect four of on demand.
 */
const ANALYSIS_EDGE = 96;

/** At or below this an 8-bit alpha value is treated as fully transparent. */
const TRANSPARENT_ALPHA_MAX = 16;

const BASIS_POINTS = 10_000;

export type ImageAlphaAnalysis = {
  width: number;
  height: number;
  hasAlphaChannel: boolean;
  /** Share of fully transparent pixels, in basis points (0-10000). */
  transparentShareBps: number;
  /** All four frame corners are transparent, as a real cutout's would be. */
  cornersTransparent: boolean;
};

export class ImageAnalysisError extends Error {
  readonly code = "IMAGE_ANALYSIS_FAILED";

  constructor(message = "The image could not be decoded.") {
    super(message);
    this.name = "ImageAnalysisError";
  }
}

/**
 * Decodes an image and reports how transparent it actually is.
 *
 * Sampling uses a nearest-neighbour resize to a fixed square: it distorts the
 * aspect ratio, which is irrelevant to a coverage proportion, but it keeps the
 * four corners of the sample the four corners of the original and avoids the
 * interpolation that a smooth kernel would introduce into the alpha channel.
 */
export async function analyzeImageAlpha(
  bytes: Uint8Array,
): Promise<ImageAlphaAnalysis> {
  const buffer = Buffer.from(bytes);
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ImageAnalysisError();
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const hasAlphaChannel = metadata.hasAlpha === true;
  if (!hasAlphaChannel)
    return {
      width,
      height,
      hasAlphaChannel: false,
      transparentShareBps: 0,
      cornersTransparent: false,
    };

  let sample;
  try {
    sample = await sharp(buffer)
      .resize(ANALYSIS_EDGE, ANALYSIS_EDGE, {
        fit: "fill",
        kernel: "nearest",
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ImageAnalysisError();
  }

  const { data, info } = sample;
  const channels = info.channels;
  const pixelCount = info.width * info.height;
  if (pixelCount === 0 || channels < 4) throw new ImageAnalysisError();

  const alphaAt = (x: number, y: number): number =>
    data[(y * info.width + x) * channels + 3] ?? 255;

  let transparentCount = 0;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const alpha = data[pixel * channels + 3] ?? 255;
    if (alpha <= TRANSPARENT_ALPHA_MAX) transparentCount++;
  }

  const lastX = info.width - 1;
  const lastY = info.height - 1;
  const cornersTransparent = [
    alphaAt(0, 0),
    alphaAt(lastX, 0),
    alphaAt(0, lastY),
    alphaAt(lastX, lastY),
  ].every((alpha) => alpha <= TRANSPARENT_ALPHA_MAX);

  return {
    width,
    height,
    hasAlphaChannel: true,
    transparentShareBps: Math.round(
      (transparentCount / pixelCount) * BASIS_POINTS,
    ),
    cornersTransparent,
  };
}
