export const SCENE_OUTPAINT_PROMPT_VERSION = "scene-outpaint-v2";
export const SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE = `VCStudio scene outpaint prompt
Layers: immutable approved source, produced canvas size, visible safe area,
contextual canvas extension, identity continuity, style continuity, and
negative constraints.`;
export const SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH =
  "c0d750d1047ed31bdd36d331ad4015da7a811ed8eedabda255ffabb6d2b9ed61";

/**
 * Describes the crop that will be applied to the generated canvas after it is
 * produced. Structural, so the renderer's own geometry type satisfies it
 * without this package depending on the application.
 */
export interface SceneOutpaintSafeArea {
  croppedAxis: "width" | "height" | "none";
  visibleWidthBps: number;
  visibleHeightBps: number;
  trimmedPerEdgeBps: number;
}

function percent(bps: number): string {
  const value = bps / 100;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/**
 * Asks for an extension of an approved still onto the canvas the provider can
 * actually return, composed for the part of that canvas the viewer will see.
 *
 * **v2 corrects a false statement made to the model.** v1 named the video
 * frame, `9:16, 1080x1920`, as the target composition. The provider cannot
 * produce 9:16; the nearest portrait canvas it offers is 1024x1536, which is
 * 2:3, and the renderer then cover-fits that into the frame and discards about
 * 7.8% of the width from each side. So the model composed for a frame it was
 * never filling, placed subjects across the full width in good faith, and the
 * renderer cut them. Every reframed video was trimmed down both sides.
 *
 * v2 states the canvas that will actually be produced, states that a crop
 * follows, and names the safe area in the model's own terms. The outer margin
 * becomes deliberate bleed rather than lost content.
 */
export function renderSceneOutpaintPrompt(input: {
  aspectRatio: "16:9" | "9:16" | "1:1";
  /** The video frame this will end up in. */
  frameWidth: number;
  frameHeight: number;
  /** The canvas the image provider will actually return. */
  canvasWidth: number;
  canvasHeight: number;
  safeArea: SceneOutpaintSafeArea;
}): string {
  const lines = [
    "Extend the supplied approved scene image onto the requested canvas without changing its existing content.",
    `Produce a ${input.canvasWidth}x${input.canvasHeight} pixel image.`,
  ];

  if (input.safeArea.croppedAxis === "width")
    lines.push(
      `That image will then be centre-cropped to fill a ${input.frameWidth}x${input.frameHeight} (${input.aspectRatio}) video frame, so only the central ${percent(input.safeArea.visibleWidthBps)}% of its width will be visible.`,
      `Keep every person, face, hand, and important object within that central band. Treat the outer ${percent(input.safeArea.trimmedPerEdgeBps)}% of the width on each side as bleed that will be discarded, and put only background there.`,
    );
  else if (input.safeArea.croppedAxis === "height")
    lines.push(
      `That image will then be centre-cropped to fill a ${input.frameWidth}x${input.frameHeight} (${input.aspectRatio}) video frame, so only the central ${percent(input.safeArea.visibleHeightBps)}% of its height will be visible.`,
      `Keep every person, face, hand, and important object within that central band. Treat the outer ${percent(input.safeArea.trimmedPerEdgeBps)}% of the height at the top and bottom as bleed that will be discarded, and put only background there.`,
    );
  else
    lines.push(
      `It will fill a ${input.frameWidth}x${input.frameHeight} (${input.aspectRatio}) video frame with no cropping.`,
    );

  lines.push(
    "Preserve every visible person, face, identity, pose, object, lighting direction, palette, camera perspective, and art style exactly.",
    "Generate only plausible surrounding visual context needed to fill the wider or taller canvas.",
    "Do not crop, redesign, replace, duplicate, move, or retouch the original subjects.",
    "Do not add text, logos, watermarks, borders, frames, or new focal subjects.",
  );

  return lines.join("\n");
}
