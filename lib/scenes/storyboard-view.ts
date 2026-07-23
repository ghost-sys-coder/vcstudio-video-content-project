import type {
  ImageGenerationStatus,
  ImageReviewStatus,
  SceneStatus,
} from "@/db/schema";
import type {
  SceneImageBatchCounts,
  SceneImageBatchDisplayStatus,
} from "@/lib/domain/bulk-scene-image";
import type { SceneBulkEligibility } from "@/lib/scenes/scene-image-eligibility";
import type {
  SceneImageApiSize,
  SceneImageQuality,
  SceneImageStylePresetView,
} from "@/lib/scenes/scene-image-view";
import type { SceneImageOutputCostMatrix } from "@/lib/costs/scene-image-cost";

export interface StoryboardSceneImageView {
  size: SceneImageApiSize;
  approvedImageUrl: string | null;
  latestImageUrl: string | null;
  latestGenerationId: string | null;
  latestStatus: ImageGenerationStatus | null;
  latestReviewStatus: ImageReviewStatus | null;
  latestGenerationVersion: number | null;
  progressPercent: number;
  estimatedCostCents: number | null;
  actualCostCents: number | null;
  safeErrorMessage: string | null;
}

export interface StoryboardSceneView {
  sceneId: string;
  sceneNumber: number;
  sceneStatus: SceneStatus;
  sceneVersionId: string;
  narrationText: string;
  characterNames: string[];
  durationMilliseconds: number;
  eligibility: SceneBulkEligibility;
  // One entry per size that has at least one generation for this scene
  // version — a scene can have an approved image per size now, not just one.
  images: StoryboardSceneImageView[];
}

export interface StoryboardBatchView {
  id: string;
  displayStatus: SceneImageBatchDisplayStatus;
  counts: SceneImageBatchCounts;
  estimatedCostCents: number;
  actualCostCents: number;
  requestedSceneCount: number;
  reservedSceneCount: number;
  createdAtLabel: string;
}

export interface StoryboardConfigurationView {
  enabled: boolean;
  maximumImagesPerBatch: number;
  manualConfirmationThresholdCents: number;
  draftQuality: "low";
  finalQuality: "medium";
  defaultSize: SceneImageApiSize;
  outputCostMatrix: SceneImageOutputCostMatrix;
}

export interface StoryboardView {
  scenes: StoryboardSceneView[];
  stylePresets: SceneImageStylePresetView[];
  latestBatch: StoryboardBatchView | null;
  configuration: StoryboardConfigurationView;
  availableBudgetCents: number;
  promptTemplateVersion: string;
}

export type StoryboardResponse =
  { success: true; data: StoryboardView } | { success: false; error: string };

export interface BulkSceneImageActionResult {
  success: boolean;
  error: string | null;
}

export interface BulkGenerateInput {
  sceneIds: string[];
  stylePresetVersionId: string;
  quality: SceneImageQuality;
  sizes: SceneImageApiSize[];
}

export type BulkGenerateHandler = (
  input: BulkGenerateInput,
) => Promise<BulkSceneImageActionResult>;

export type StoryboardReviewHandler = (
  generationId: string,
) => Promise<BulkSceneImageActionResult>;
