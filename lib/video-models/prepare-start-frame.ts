import "server-only";

import sharp from "sharp";
import {
  measureCoverCrop,
  type CoverCropGeometry,
} from "@/lib/render/frame-geometry";

/**
 * Fits an approved still onto the exact canvas a video model starts from.
 *
 * **Why this is needed at all.** The video API accepts a starting image only at
 * the same size as the clip it will produce. Our approved stills are 1536x1024
 * or 1024x1536, which are 3:2 and 2:3, while the clip canvases are 1280x720 and
 * 720x1280, which are exactly 16:9 and 9:16. The still therefore has to be
 * recut before it can be animated.
 *
 * **What that costs, stated rather than hidden.** Fitting a 3:2 still onto a
 * 16:9 canvas trims about 7.8% from the top and the bottom. That is the same
 * arithmetic that cut the sides off reframed videos, so it is measured with the
 * same function and handed back rather than absorbed silently. The caller
 * decides whether to say it out loud; this only refuses to pretend it did not
 * happen.
 *
 * PNG out, because the reference frame should not carry a second generation of
 * compression artefacts into a model that is about to interpret it.
 */
export async function prepareStartFrame(input: {
  bytes: Uint8Array;
  targetWidth: number;
  targetHeight: number;
}): Promise<{
  bytes: Uint8Array;
  mimeType: "image/png";
  /** What the fit removed. `matchesFrame` when the still was already the shape. */
  crop: CoverCropGeometry;
}> {
  if (input.targetWidth <= 0 || input.targetHeight <= 0)
    throw new RangeError("A start frame needs a positive target size.");

  const image = sharp(Buffer.from(input.bytes));
  const metadata = await image.metadata();

  const crop = measureCoverCrop({
    imageWidth: metadata.width ?? null,
    imageHeight: metadata.height ?? null,
    frameWidth: input.targetWidth,
    frameHeight: input.targetHeight,
  });

  const resized = await image
    .resize(input.targetWidth, input.targetHeight, {
      // Cover and centre, matching how the renderer itself places a still, so
      // the clip begins on the framing a creator has already been looking at.
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();

  return {
    bytes: new Uint8Array(resized),
    mimeType: "image/png",
    crop,
  };
}
