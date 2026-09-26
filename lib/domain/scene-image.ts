import type { SceneImageGeneration } from "@/db/schema";
import {
  getSceneImageDimensions,
  type SceneImageApiSize,
  type SceneImageOutputFormat,
} from "@/lib/schemas/scene-image";

/**
 * How far an uploaded image's proportions may sit from the slot it is going into.
 *
 * **Twenty per cent, chosen from the ratios people actually upload.** At the
 * previous ten, a plain 16:9 screenshot missed a 3:2 slot by 18.5% and even an
 * ordinary 4:3 photo missed by 11.1% — so the guard rejected most real files
 * rather than the badly wrong ones it was aimed at. Twenty admits every common
 * camera and screen ratio into the slot of its own orientation, while still
 * refusing genuinely wrong shapes: a widescreen frame into a square slot is
 * 77.8% off, an ultrawide into 3:2 is 55.6%, and both stay rejected.
 *
 * **Loosening it risks no distortion.** `DEFAULT_SCENE_FRAMING` is `cover` with
 * a centred focal point, so an accepted mismatch is cropped at the edges, never
 * stretched, and the framing editor can move the crop afterwards. The worst
 * case this now admits — 16:9 into 3:2 — trims about 8% from each side.
 *
 * A constant rather than an environment variable on purpose: it encodes a
 * judgement about picture quality that belongs with the reasoning above, not in
 * a deployment setting nobody would know how to pick a value for.
 */
const DEFAULT_ASPECT_RATIO_TOLERANCE = 0.2;

export type AiGeneratedSceneImageGeneration = SceneImageGeneration & {
  idempotencyKey: string;
  requestFingerprint: string;
  model: string;
  quality: NonNullable<SceneImageGeneration["quality"]>;
  outputCompression: number;
  promptTemplateVersion: string;
  stylePresetVersion: number;
  finalPrompt: string;
  stylePresetVersionId: string;
  promptTemplateVersionId: string;
};

/**
 * Every AI-generated row is written with all of these fields populated by
 * createSceneImageGenerationReservation; a user_uploaded row never has a
 * Trigger run dispatched against it, so any generation reaching AI-only
 * code (the provider call, batch dispatch, reconciliation) is guaranteed to
 * satisfy this — this only exists to make that guarantee explicit and
 * type-checked rather than assumed.
 */
export function assertAiGeneratedSceneImage(
  generation: SceneImageGeneration,
): asserts generation is AiGeneratedSceneImageGeneration {
  if (generation.source !== "ai_generated")
    throw new Error(
      "SCENE_IMAGE_GENERATION_NOT_AI_GENERATED: expected an AI-generated row.",
    );
}

export function sceneImageOutputFormatForUploadContentType(
  contentType: "image/png" | "image/jpeg" | "image/webp",
): SceneImageOutputFormat {
  if (contentType === "image/jpeg") return "jpeg";
  if (contentType === "image/webp") return "webp";
  return "png";
}

/**
 * An uploaded image doesn't need to match a target size's exact pixel
 * dimensions (unlike AI output) — but a badly mismatched aspect ratio would
 * get visibly stretched or cropped by the framing pipeline downstream, so
 * this rejects uploads whose aspect ratio deviates from the target size's by
 * more than the tolerance.
 */
/**
 * Why an upload was refused, in numbers the creator can act on.
 *
 * The bare refusal said only that the proportions did not match "closely
 * enough", which leaves someone guessing whether they are slightly off or
 * hopelessly off, and whether cropping would help or a different slot would.
 */
export function describeSceneImageAspectMismatch(input: {
  width: number;
  height: number;
  targetSize: SceneImageApiSize;
  toleranceRatio?: number;
}): string {
  if (input.width <= 0 || input.height <= 0)
    return "That file's dimensions could not be read.";

  const tolerance = input.toleranceRatio ?? DEFAULT_ASPECT_RATIO_TOLERANCE;
  const target = getSceneImageDimensions(input.targetSize);
  const targetRatio = target.width / target.height;
  const uploadedRatio = input.width / input.height;
  const deviation = Math.abs(uploadedRatio - targetRatio) / targetRatio;

  return [
    `This image is ${input.width}×${input.height} (${uploadedRatio.toFixed(2)}:1)`,
    `but this slot expects ${target.width}×${target.height} (${targetRatio.toFixed(2)}:1).`,
    `That is ${Math.round(deviation * 100)}% off, and the limit is ${Math.round(tolerance * 100)}%.`,
    uploadedRatio > targetRatio
      ? "Crop some width off, or choose a wider slot."
      : "Crop some height off, or choose a taller slot.",
  ].join(" ");
}

export function isSceneImageUploadAspectRatioAllowed(input: {
  width: number;
  height: number;
  targetSize: SceneImageApiSize;
  toleranceRatio?: number;
}): boolean {
  if (input.width <= 0 || input.height <= 0) return false;
  const tolerance = input.toleranceRatio ?? DEFAULT_ASPECT_RATIO_TOLERANCE;
  const target = getSceneImageDimensions(input.targetSize);
  const targetAspectRatio = target.width / target.height;
  const uploadedAspectRatio = input.width / input.height;
  const deviation =
    Math.abs(uploadedAspectRatio - targetAspectRatio) / targetAspectRatio;
  return deviation <= tolerance;
}
