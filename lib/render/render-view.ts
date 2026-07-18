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
  label: string;
  description: string;
  aspectRatio: RenderAspectRatio;
  width: number;
  height: number;
  isProjectDefault: boolean;
  disabled: boolean;
}

export interface RenderConfigurationView {
  enabled: boolean;
  maxRenderDurationSeconds: number;
  estimatedCostCents: number;
  withinDurationLimit: boolean;
  watermarkAvailable: boolean;
}

export interface RenderWorkspaceView {
  timeline: RenderTimelineSummaryView;
  presets: RenderPresetView[];
  configuration: RenderConfigurationView;
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
  includeCaptions: boolean;
  includeWatermark: boolean;
}
