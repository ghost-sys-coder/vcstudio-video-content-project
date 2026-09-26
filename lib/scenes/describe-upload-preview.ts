import {
  describeSceneImageAspectMismatch,
  isSceneImageUploadAspectRatioAllowed,
} from "@/lib/domain/scene-image";
import { measureCoverCrop } from "@/lib/render/frame-geometry";
import {
  getSceneImageDimensions,
  type SceneImageApiSize,
} from "@/lib/schemas/scene-image";

/**
 * What a chosen file will do, said before it is uploaded rather than after.
 *
 * The upload already answers this — it inspects the file, applies the aspect
 * guard and refuses if it is too far off. The trouble is the answer arrives
 * after the bytes have crossed the network and been deleted again. The same
 * judgement runs perfectly well in the browser, so the creator can see it while
 * they still have the file picker open.
 *
 * **Guidance, never a veto.** The server stays authoritative, because it
 * measures the stored pixels with `sharp` while a browser may report a photo's
 * dimensions after applying its rotation tag. Blocking an upload on the
 * browser's reading would refuse files the server would have taken.
 */

export type UploadPreviewVerdict = "fits" | "cropped" | "refused";

export interface UploadPreview {
  verdict: UploadPreviewVerdict;
  /** One line, safe to show as-is. */
  message: string;
  /** How much each edge loses to the crop, for the cases that are accepted. */
  trimmedPerEdgePercent: number;
}

/** Below this the crop is not worth mentioning; rounding shows it as zero. */
const NEGLIGIBLE_TRIM_BPS = 50;

export function describeUploadPreview(input: {
  width: number;
  height: number;
  targetSize: SceneImageApiSize;
}): UploadPreview {
  if (input.width <= 0 || input.height <= 0)
    return {
      verdict: "refused",
      message: "That file's dimensions could not be read.",
      trimmedPerEdgePercent: 0,
    };

  if (
    !isSceneImageUploadAspectRatioAllowed({
      width: input.width,
      height: input.height,
      targetSize: input.targetSize,
    })
  )
    return {
      verdict: "refused",
      message: describeSceneImageAspectMismatch(input),
      trimmedPerEdgePercent: 0,
    };

  const target = getSceneImageDimensions(input.targetSize);
  const crop = measureCoverCrop({
    imageWidth: input.width,
    imageHeight: input.height,
    frameWidth: target.width,
    frameHeight: target.height,
  });
  const trimmedPerEdgePercent = Math.round(crop.trimmedPerEdgeBps / 100);

  if (crop.trimmedPerEdgeBps <= NEGLIGIBLE_TRIM_BPS)
    return {
      verdict: "fits",
      message: `${input.width}×${input.height} matches this size. Nothing will be cropped.`,
      trimmedPerEdgePercent: 0,
    };

  // Said plainly, because it is the part a creator cannot see coming: the image
  // is accepted, and then loses its edges at render time.
  const edges =
    crop.croppedAxis === "width" ? "each side" : "the top and bottom";
  return {
    verdict: "cropped",
    message: `${input.width}×${input.height} fits this size, but about ${trimmedPerEdgePercent}% will be trimmed from ${edges}. You can move the crop later in the framing editor.`,
    trimmedPerEdgePercent,
  };
}
