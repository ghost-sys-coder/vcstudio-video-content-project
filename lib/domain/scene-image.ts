import type { SceneImageGeneration } from "@/db/schema";
import {
  getSceneImageDimensions,
  type SceneImageApiSize,
  type SceneImageOutputFormat,
} from "@/lib/schemas/scene-image";

const DEFAULT_ASPECT_RATIO_TOLERANCE = 0.1;

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
