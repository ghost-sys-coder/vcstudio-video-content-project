import { renderSceneOutpaintPrompt } from "@studio/prompts";
import { measureCoverCrop } from "@/lib/render/frame-geometry";
import {
  getSceneImageDimensions,
  getSceneImageSizeForAspectRatio,
} from "@/lib/schemas/scene-image";

/**
 * Builds the outpaint prompt for an output variant.
 *
 * One function rather than three call sites because the prompt is priced,
 * fingerprinted and stored: the estimate shown before spending and the request
 * actually sent must be the same string, or the reservation reconciles against
 * work it did not describe. It also owns the one fact the callers kept getting
 * wrong, that the canvas the provider returns is not the shape of the frame.
 */
export function buildSceneOutpaintPrompt(outputVariant: {
  aspectRatio: "16:9" | "9:16" | "1:1";
  width: number;
  height: number;
}): string {
  const canvas = getSceneImageDimensions(
    getSceneImageSizeForAspectRatio(outputVariant.aspectRatio),
  );
  return renderSceneOutpaintPrompt({
    aspectRatio: outputVariant.aspectRatio,
    frameWidth: outputVariant.width,
    frameHeight: outputVariant.height,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    safeArea: measureCoverCrop({
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      frameWidth: outputVariant.width,
      frameHeight: outputVariant.height,
    }),
  });
}
