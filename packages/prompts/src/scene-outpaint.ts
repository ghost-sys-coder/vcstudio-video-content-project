export const SCENE_OUTPAINT_PROMPT_VERSION = "scene-outpaint-v1";
export const SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE = `VCStudio scene outpaint prompt
Layers: immutable approved source, target output dimensions, contextual canvas
extension, identity continuity, style continuity, and negative constraints.`;
export const SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH =
  "edf57d722c63ce2f42ed6fa89787b8aef2694e8968ac0f96453d3b1f417b5f97";

export function renderSceneOutpaintPrompt(input: {
  aspectRatio: "16:9" | "9:16" | "1:1";
  width: number;
  height: number;
}): string {
  return [
    "Extend the supplied approved scene image to the requested canvas without changing its existing content.",
    `Target composition: ${input.aspectRatio}, ${input.width}x${input.height}.`,
    "Preserve every visible person, face, identity, pose, object, lighting direction, palette, camera perspective, and art style exactly.",
    "Generate only plausible surrounding visual context needed to fill the wider or taller canvas.",
    "Do not crop, redesign, replace, duplicate, move, or retouch the original subjects.",
    "Do not add text, logos, watermarks, borders, frames, or new focal subjects.",
  ].join("\n");
}
