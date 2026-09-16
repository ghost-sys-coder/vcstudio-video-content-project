import type {
  ImageGenerationStatus,
  ImageReviewStatus,
  SceneStatus,
} from "@/db/schema";
import type {
  SceneImageBatchCounts,
  SceneImageBatchDisplayStatus,
} from "@/lib/domain/bulk-scene-image";
import type { ScenePacingFit } from "@/lib/pacing/plan-scene-pacing";
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
  /**
   * How many distinct images this scene actually shows, measured on its
   * best-covered size.
   *
   * Per size rather than in total, because that is how the renderer reads it:
   * a scene changes image using the shots approved for the size being rendered,
   * so two approved stills at different sizes are one picture each, not two
   * changes.
   */
  approvedShotCount: number;
  /** What the project's pace asks of a scene this long. */
  targetShotCount: number;
  /** Advice only. Nothing generates from it, because images cost money. */
  pacingFit: ScenePacingFit;
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
  /**
   * The style version this project was created with, when it has one. The
   * generate dialogs preselect it so a project keeps producing the look it was
   * started in without anyone having to remember which that was. Null for
   * projects created before a project-level style existed, and for those the
   * dialogs fall back to the workspace default exactly as before.
   */
  projectStylePresetVersionId: string | null;
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
