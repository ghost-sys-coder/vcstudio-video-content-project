import "server-only";

import type { Project, VideoRender } from "@/db/schema";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import { listVideoRenders } from "@/db/repositories/video-render.repository";
import { getRenderEnvironment } from "@/lib/env/server";
import {
  defaultPresetForAspectRatio,
  RENDER_PRESETS,
  type RenderAspectRatio,
} from "@/lib/render/render-formats";
import { estimateRenderCostCents } from "@/lib/render/render-cost";
import { validateRenderDuration } from "@/lib/render/render-duration";
import {
  calculateAvailableSceneImageBudgetCents,
  getUtcBudgetWindowStarts,
} from "@/lib/scenes/scene-image-budget";
import { buildSubtitleContext } from "@/lib/subtitles/subtitle-workspace-details";
import type {
  RenderExportView,
  RenderPresetView,
  RenderTimelineSummaryView,
  RenderWorkspaceView,
} from "@/lib/render/render-view";

const ACTIVE_STATUSES: ReadonlySet<VideoRender["status"]> = new Set([
  "pending",
  "queued",
  "running",
]);

function toExportView(render: VideoRender): RenderExportView {
  return {
    id: render.id,
    status: render.status,
    preset: render.preset,
    aspectRatio: render.aspectRatio as RenderAspectRatio,
    width: render.width,
    height: render.height,
    framesPerSecond: render.framesPerSecond,
    includeCaptions: render.includeCaptions,
    includeWatermark: render.includeWatermark,
    sceneCount: render.sceneCount,
    captionCount: render.captionCount,
    durationMilliseconds: render.durationMilliseconds,
    totalFrames: render.totalFrames,
    progressPercent: render.progressPercent,
    estimatedCostCents: render.estimatedCostCents,
    actualCostCents: render.actualCostCents,
    sizeBytes: render.assetSizeBytes,
    hasAsset: render.status === "succeeded" && render.assetObjectKey !== null,
    errorMessage: render.safeErrorMessage,
    createdAt: render.createdAt.toISOString(),
    completedAt: render.completedAt ? render.completedAt.toISOString() : null,
  };
}

/**
 * Assembles the render workspace view: the deterministic timeline summary
 * (reusing the subtitle context so preview, export, and render all agree), the
 * available output presets, the cost/limit configuration, and the project's
 * render history with the currently active render surfaced.
 */
export async function loadRenderWorkspace(input: {
  workspaceId: string;
  project: Project;
  now?: Date;
}): Promise<RenderWorkspaceView> {
  const environment = getRenderEnvironment();
  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };

  const [context, renders] = await Promise.all([
    buildSubtitleContext({
      workspaceId: input.workspaceId,
      project: input.project,
    }),
    listVideoRenders(scope),
  ]);

  const report = context.timeline.report;
  const readyTimeline =
    context.timeline.status === "ready" ? context.timeline.timeline : null;
  const ready = readyTimeline !== null;
  const totalDurationMilliseconds = readyTimeline
    ? readyTimeline.totalDurationMilliseconds
    : 0;

  const timeline: RenderTimelineSummaryView = {
    status: context.timeline.status,
    width: input.project.width,
    height: input.project.height,
    framesPerSecond: input.project.framesPerSecond,
    sceneCount: readyTimeline
      ? readyTimeline.scenes.length
      : context.scenes.length,
    captionCount: readyTimeline ? readyTimeline.captionCount : 0,
    totalDurationMilliseconds,
    totalFrames: readyTimeline ? readyTimeline.totalFrames : 0,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    issues: report.issues.map((issue) => ({
      sceneNumber: issue.sceneNumber,
      severity: issue.severity,
      message: issue.message,
    })),
  };

  const projectPreset = defaultPresetForAspectRatio(
    input.project.aspectRatio as RenderAspectRatio,
  );
  const presets: RenderPresetView[] = RENDER_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    description: preset.description,
    aspectRatio: preset.aspectRatio,
    width: preset.width,
    height: preset.height,
    isProjectDefault: preset.id === projectPreset.id,
    disabled: preset.id !== projectPreset.id,
  }));

  const estimatedCostCents = ready
    ? estimateRenderCostCents({
        durationMilliseconds: totalDurationMilliseconds,
        rates: {
          costPerMinuteCents: environment.VIDEO_RENDER_COST_PER_MINUTE_CENTS,
          minimumEstimateCents: environment.VIDEO_RENDER_MINIMUM_ESTIMATE_CENTS,
        },
      })
    : 0;
  const withinDurationLimit =
    ready &&
    validateRenderDuration({
      durationMilliseconds: totalDurationMilliseconds,
      maxRenderDurationSeconds: environment.MAX_RENDER_DURATION_SECONDS,
    }).ok;

  const now = input.now ?? new Date();
  const { dailyWindowStart, monthlyWindowStart } =
    getUtcBudgetWindowStarts(now);
  const [
    projectCommittedCents,
    workspaceDailyCommittedCents,
    workspaceMonthlyCommittedCents,
  ] = await Promise.all([
    getProjectCommittedCostCents(scope),
    getWorkspaceCommittedCostCents({
      workspaceId: input.workspaceId,
      since: dailyWindowStart,
    }),
    getWorkspaceCommittedCostCents({
      workspaceId: input.workspaceId,
      since: monthlyWindowStart,
    }),
  ]);
  const availableBudgetCents = calculateAvailableSceneImageBudgetCents({
    projectLimitCents: input.project.maximumBudgetCents,
    projectCommittedCents,
    workspaceDailyLimitCents: environment.DEFAULT_DAILY_BUDGET_CENTS,
    workspaceDailyCommittedCents,
    workspaceMonthlyLimitCents: environment.DEFAULT_MONTHLY_BUDGET_CENTS,
    workspaceMonthlyCommittedCents,
  });

  const exports = renders.map(toExportView);
  const activeRender =
    exports.find((render) => ACTIVE_STATUSES.has(render.status)) ?? null;

  return {
    timeline,
    presets,
    configuration: {
      enabled: environment.ENABLE_VIDEO_RENDERING,
      maxRenderDurationSeconds: environment.MAX_RENDER_DURATION_SECONDS,
      estimatedCostCents,
      withinDurationLimit,
      watermarkAvailable: environment.VIDEO_WATERMARK_TEXT.length > 0,
    },
    exports,
    activeRender,
    availableBudgetCents,
  };
}
