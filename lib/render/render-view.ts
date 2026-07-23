import type { RenderStatus } from "@/db/schema";
import type { RenderAspectRatio } from "@/lib/render/render-formats";

export interface RenderExportView {
  id: string;
  status: RenderStatus;
  preset: string;
  aspectRatio: RenderAspectRatio;
  width: number;
  height: number;
  framesPerSecond: number;
  includeCaptions: boolean;
  includeWatermark: boolean;
  sceneCount: number;
  captionCount: number;
  durationMilliseconds: number;
  totalFrames: number;
  progressPercent: number;
  estimatedCostCents: number;
  actualCostCents: number | null;
  sizeBytes: number | null;
  hasAsset: boolean;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface RenderTimelineIssueView {
  sceneNumber: number | null;
  severity: "error" | "warning";
  message: string;
}

export interface RenderTimelineSummaryView {
  status: "ready" | "invalid";
  width: number;
  height: number;
  framesPerSecond: number;
  sceneCount: number;
  captionCount: number;
  totalDurationMilliseconds: number;
  totalFrames: number;
  errorCount: number;
  warningCount: number;
  issues: RenderTimelineIssueView[];
}

export interface RenderPresetView {
  id: string;
  outputVariantId: string;
  label: string;
  description: string;
  aspectRatio: RenderAspectRatio;
  width: number;
  height: number;
  isProjectDefault: boolean;
  isSelected: boolean;
  disabled: boolean;
}

export interface RenderConfigurationView {
  enabled: boolean;
  maxRenderDurationSeconds: number;
  estimatedCostCents: number;
  withinDurationLimit: boolean;
  watermarkAvailable: boolean;
  outpaintEstimatedCostCents: number;
}

export interface RenderSceneFramingView {
  sceneId: string;
  sceneVersionId: string;
  sceneNumber: number;
  sourceImageGenerationId: string;
  approvedSourceImageGenerationId: string;
  mode: "cover" | "contain" | "outpaint";
  focalPointXBps: number;
  focalPointYBps: number;
  scaleBps: number;
  backgroundColor: string;
  customized: boolean;
  outpaintStatus: "idle" | "queued" | "running" | "succeeded" | "failed";
  outpaintError: string | null;
  // True when a natively-generated approved image already exists at this
  // output variant's exact size — the render uses it directly and this
  // scene's framing/outpaint settings are not applied.
  hasNativeMatch: boolean;
}

export interface ShortSourceSceneView {
  sceneId: string;
  sceneVersionId: string;
  sceneNumber: number;
  startMilliseconds: number;
  endMilliseconds: number;
  captionBoundariesMilliseconds: number[];
}

export interface ShortCompositionView {
  id: string;
  name: string;
  status: "draft" | "ready" | "archived";
  outputVariantId: string;
  clipCount: number;
  durationMilliseconds: number;
  estimatedRenderCostCents: number;
  createdAt: string;
}

export interface RenderWorkspaceView {
  selectedOutputVariantId: string;
  timeline: RenderTimelineSummaryView;
  presets: RenderPresetView[];
  configuration: RenderConfigurationView;
  sceneFramings: RenderSceneFramingView[];
  shortSourceScenes: ShortSourceSceneView[];
  shorts: ShortCompositionView[];
  exports: RenderExportView[];
  activeRender: RenderExportView | null;
  availableBudgetCents: number;
}

export type RenderWorkspaceResponse =
  | { success: true; data: RenderWorkspaceView }
  | { success: false; error: string };

export interface RenderActionIssue {
  sceneNumber: number | null;
  message: string;
}

export interface RenderActionResult {
  success: boolean;
  error: string | null;
  renderId?: string | null;
  issues?: RenderActionIssue[];
}

export interface StartRenderInput {
  presetId: string;
  outputVariantId: string;
  shortCompositionId?: string;
  includeCaptions: boolean;
  includeWatermark: boolean;
}
