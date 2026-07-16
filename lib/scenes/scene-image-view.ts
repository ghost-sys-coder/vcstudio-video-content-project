import type { ImageGenerationStatus, ImageReviewStatus } from "@/db/schema";
import type {
  SceneImageApiSize as ValidatedSceneImageApiSize,
  SceneImageOutputFormat as ValidatedSceneImageOutputFormat,
  SceneImageQuality as ValidatedSceneImageQuality,
} from "@/lib/schemas/scene-image";

export type SceneImageQuality = ValidatedSceneImageQuality;
export type SceneImageApiSize = ValidatedSceneImageApiSize;
export type SceneImageGenerationStatus = ImageGenerationStatus;
export type SceneImageReviewStatus = ImageReviewStatus;
export type SceneImageOutputFormat = ValidatedSceneImageOutputFormat;

export interface SceneImageStylePresetView {
  id: string;
  versionId: string;
  name: string;
  description: string;
  version: number;
  isDefault: boolean;
  positivePrompt: string;
  negativePrompt: string;
  defaultAspectRatio: "16:9" | "9:16" | "1:1";
}

export interface SceneImageReferenceView {
  id: string;
  characterId: string;
  characterName: string;
  typeLabel: string;
  referenceType: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

export interface SceneImageClientConfiguration {
  enabled: boolean;
  model: string;
  outputFormat: SceneImageOutputFormat;
  draftQuality: "low";
  finalQuality: "medium";
  draftCompression: number;
  finalCompression: number;
  maximumReferenceAssets: number;
  defaultSize: SceneImageApiSize;
  textInputCostPerMillionCents: number;
  referenceInputReserveCents: number;
  outputCostMatrix: Record<
    SceneImageQuality,
    Record<SceneImageApiSize, number>
  >;
}

export interface SceneImageDetailsView {
  stylePresets: SceneImageStylePresetView[];
  references: SceneImageReferenceView[];
  generations: SceneImageGenerationView[];
  configuration: SceneImageClientConfiguration;
  promptTemplateVersion: string;
  availableBudgetCents: number;
}

export type SceneImageDetailsResponse =
  | { success: true; data: SceneImageDetailsView }
  | { success: false; error: string };

export interface SceneImageSelection {
  stylePresetVersionId: string;
  quality: SceneImageQuality;
  size: SceneImageApiSize;
  referenceAssetIds: string[];
}

export interface SceneImageGenerationRequest extends SceneImageSelection {
  requestNonce: string;
}

export interface SceneImageActionResult {
  success: boolean;
  error: string | null;
}

export interface SceneImageGenerationView {
  id: string;
  generationVersion: number;
  status: SceneImageGenerationStatus;
  reviewStatus: SceneImageReviewStatus;
  model: string;
  quality: SceneImageQuality;
  size: SceneImageApiSize;
  outputFormat: SceneImageOutputFormat;
  outputCompression: number;
  finalPrompt: string;
  promptTemplateVersion: string;
  stylePresetName: string;
  stylePresetVersion: number;
  imageUrl: string | null;
  estimatedCostCents: number;
  actualCostCents: number | null;
  progressPercent: number;
  attemptCount: number;
  safeErrorMessage: string | null;
  reservationReleased: boolean;
  referenceAssetIds: string[];
  createdAtLabel: string;
}

export function isActiveSceneImageGenerationStatus(
  status: SceneImageGenerationStatus,
) {
  return status === "pending" || status === "queued" || status === "running";
}
