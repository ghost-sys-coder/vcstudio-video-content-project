import type { VideoContentPlatform } from "@/lib/platforms/video-content-platforms";
import { getThumbnailSizeForPlatform } from "@/lib/schemas/thumbnail";
import { getSceneImageDimensions } from "@/lib/schemas/scene-image";

/**
 * Whether an image a creator supplied is the right shape to be a thumbnail.
 *
 * This deliberately does NOT reuse the scene-image check. That one compares an
 * upload against the size the image model produced, which for landscape is
 * 1536x1024, or 3:2 — the widest shape OpenAI's image model offers. A creator's
 * own YouTube thumbnail is 16:9, which is 18.5% away from 3:2 and so was
 * rejected by a 10% tolerance, as was every standard vertical cover at 9:16.
 * Every correctly sized thumbnail failed.
 *
 * The model's limitation has no business constraining a file the creator made
 * elsewhere, so an upload is judged against a band of real thumbnail shapes
 * instead: anything from a 4:3 photo to a full 16:9 frame in landscape, and
 * from 9:16 to 3:4 in portrait. Both bands contain the shape this app
 * generates, so a generated thumbnail that is downloaded and re-uploaded still
 * passes, and both still reject a square or a wildly wrong crop.
 */
export type ThumbnailOrientation = "landscape" | "portrait";

/** A small slack so integer dimensions that read as 16:9 are not lost to rounding. */
const RATIO_SLACK = 0.02;

const BANDS: Record<
  ThumbnailOrientation,
  {
    minimum: number;
    maximum: number;
    minimumLabel: string;
    maximumLabel: string;
  }
> = {
  // 4:3 through 16:9.
  landscape: {
    minimum: 4 / 3,
    maximum: 16 / 9,
    minimumLabel: "4:3",
    maximumLabel: "16:9",
  },
  // 9:16 through 3:4.
  portrait: {
    minimum: 9 / 16,
    maximum: 3 / 4,
    minimumLabel: "9:16",
    maximumLabel: "3:4",
  },
};

/** A concrete size to aim for, as an example rather than a platform rule. */
const EXAMPLE_DIMENSIONS: Record<ThumbnailOrientation, string> = {
  landscape: "1280 × 720",
  portrait: "1080 × 1920",
};

export interface ThumbnailUploadTarget {
  orientation: ThumbnailOrientation;
  /** The shape range an upload may take, e.g. "4:3 to 16:9". */
  shapeLabel: string;
  /** A concrete example size, e.g. "1280 × 720". */
  exampleDimensions: string;
  /** The aspect ratio the preview frame is drawn at. */
  previewAspectRatio: number;
}

export function describeThumbnailUploadTarget(
  platform: VideoContentPlatform,
): ThumbnailUploadTarget {
  const generated = getSceneImageDimensions(
    getThumbnailSizeForPlatform(platform),
  );
  const orientation: ThumbnailOrientation =
    generated.width >= generated.height ? "landscape" : "portrait";
  const band = BANDS[orientation];
  return {
    orientation,
    shapeLabel: `${band.minimumLabel} to ${band.maximumLabel}`,
    exampleDimensions: EXAMPLE_DIMENSIONS[orientation],
    // Previewed at the shape the platform actually displays, which is the far
    // end of the band, so a creator sees the framing they will really get.
    previewAspectRatio:
      orientation === "landscape" ? band.maximum : band.minimum,
  };
}

/** Reduces a ratio to a readable label such as "16:9". */
export function describeAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "unknown";
  const divisor = (function greatestCommonDivisor(
    a: number,
    b: number,
  ): number {
    return b === 0 ? a : greatestCommonDivisor(b, a % b);
  })(Math.round(width), Math.round(height));
  const left = Math.round(width) / divisor;
  const right = Math.round(height) / divisor;
  // A reduced ratio is only useful when it is small enough to recognise.
  if (left <= 40 && right <= 40) return `${left}:${right}`;
  return `${(width / height).toFixed(2)}:1`;
}

export type ThumbnailUploadFit =
  | { fits: true; target: ThumbnailUploadTarget }
  | { fits: false; target: ThumbnailUploadTarget; message: string };

/**
 * Judges one image against a platform's thumbnail shape.
 *
 * A rejection always says three things: what the image is, what is needed, and
 * a concrete size to aim for. "Proportions don't match closely enough" tells a
 * creator nothing they can act on.
 */
export function checkThumbnailUploadFit(input: {
  platform: VideoContentPlatform;
  width: number;
  height: number;
}): ThumbnailUploadFit {
  const target = describeThumbnailUploadTarget(input.platform);
  if (
    !Number.isFinite(input.width) ||
    !Number.isFinite(input.height) ||
    input.width <= 0 ||
    input.height <= 0
  )
    return {
      fits: false,
      target,
      message: "That file's dimensions could not be read, so it was not saved.",
    };

  const band = BANDS[target.orientation];
  const ratio = input.width / input.height;
  if (
    ratio >= band.minimum * (1 - RATIO_SLACK) &&
    ratio <= band.maximum * (1 + RATIO_SLACK)
  )
    return { fits: true, target };

  const actual = `${Math.round(input.width)} × ${Math.round(input.height)}`;
  const shape = describeAspectRatio(input.width, input.height);
  const wrongWay =
    (target.orientation === "landscape" && ratio < 1) ||
    (target.orientation === "portrait" && ratio > 1);
  const orientationNote = wrongWay
    ? ` This image is ${target.orientation === "landscape" ? "portrait" : "landscape"}, and a ${target.orientation} thumbnail is needed.`
    : "";

  return {
    fits: false,
    target,
    message: `This image is ${actual}, which is ${shape}.${orientationNote} A ${target.orientation} thumbnail needs to be between ${target.shapeLabel} — for example ${target.exampleDimensions}. Crop or resize it and try again.`,
  };
}
