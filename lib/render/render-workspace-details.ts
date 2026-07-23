import "server-only";

import type { Project, VideoRender } from "@/db/schema";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import { listVideoRenders } from "@/db/repositories/video-render.repository";
import { listProjectOutputVariants } from "@/db/repositories/output-variants.repository";
import {
  listSceneVariantFramings,
  listSceneVariantOutpaints,
} from "@/db/repositories/output-variants.repository";
import { listSucceededSceneImageGenerationsByIds } from "@/db/repositories/scene-images.repository";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import { listApprovedSceneImageAssets } from "@/db/repositories/subtitle.repository";
import {
  listProjectShortClips,
  listShortCompositions,
} from "@/db/repositories/shorts.repository";
import { DEFAULT_SCENE_FRAMING } from "@/lib/output-variants/scene-framing";
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
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { loadEffectiveWorkspaceLimits } from "@/lib/budgets/current-settings";
import { estimateSceneOutpaintCost } from "@/lib/output-variants/start-scene-outpaint";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";
import { renderSceneOutpaintPrompt } from "@studio/prompts";
import {
  buildOutputVariantTimelineContext,
  resolveProjectOutputVariant,
} from "@/lib/output-variants/output-variant-context";
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

function toOutpaintStatus(
  status:
    | (typeof import("@/db/schema").sceneImageGenerations.$inferSelect)["status"]
    | undefined,
): "idle" | "queued" | "running" | "succeeded" | "failed" {
  if (!status) return "idle";
  if (status === "pending") return "queued";
  if (status === "cancelled") return "failed";
  return status;
}

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
  outputVariantId?: string | null;
  now?: Date;
}): Promise<RenderWorkspaceView> {
  const environment = getRenderEnvironment();
  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };
  const effectiveLimits = await loadEffectiveWorkspaceLimits({
    workspaceId: input.workspaceId,
  });

  const [
    selectedVariant,
    variants,
    renders,
    currentScenes,
    shortRows,
    shortClipRows,
  ] = await Promise.all([
    resolveProjectOutputVariant(input),
    listProjectOutputVariants(scope),
    listVideoRenders(scope),
    listCurrentScenes(scope),
    listShortCompositions(scope),
    listProjectShortClips(scope),
  ]);
  const sceneVersionIds = currentScenes.map(({ version }) => version.id);
  const canonicalSize = getSceneImageSizeForAspectRatio(
    input.project.aspectRatio,
  );
  const nativeSize = getSceneImageSizeForAspectRatio(
    selectedVariant.aspectRatio,
  );
  const [context, approvedImages, nativeImages, storedFramings, outpaints] =
    await Promise.all([
      buildOutputVariantTimelineContext({
        workspaceId: input.workspaceId,
        project: input.project,
        outputVariant: selectedVariant,
      }),
      listApprovedSceneImageAssets({
        ...scope,
        sceneVersionIds,
        size: canonicalSize,
      }),
      nativeSize !== canonicalSize
        ? listApprovedSceneImageAssets({
            ...scope,
            sceneVersionIds,
            size: nativeSize,
          })
        : Promise.resolve([]),
      listSceneVariantFramings({
        ...scope,
        outputVariantId: selectedVariant.id,
      }),
      listSceneVariantOutpaints({
        ...scope,
        outputVariantId: selectedVariant.id,
      }),
    ]);
  const adaptedImages = await listSucceededSceneImageGenerationsByIds({
    ...scope,
    generationIds: storedFramings.map(
      (framing) => framing.sourceImageGenerationId,
    ),
  });

  const report = context.timeline.report;
  const readyTimeline =
    context.timeline.status === "ready" ? context.timeline.timeline : null;
  const ready = readyTimeline !== null;
  const totalDurationMilliseconds = readyTimeline
    ? readyTimeline.totalDurationMilliseconds
    : 0;

  const timeline: RenderTimelineSummaryView = {
    status: context.timeline.status,
    width: selectedVariant.width,
    height: selectedVariant.height,
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
    outputVariantId:
      variants.find((variant) => variant.aspectRatio === preset.aspectRatio)
        ?.id ?? "",
    id: preset.id,
    label: preset.label,
    description: preset.description,
    aspectRatio: preset.aspectRatio,
    width: preset.width,
    height: preset.height,
    isProjectDefault: preset.id === projectPreset.id,
    isSelected: preset.aspectRatio === selectedVariant.aspectRatio,
    disabled: !variants.some(
      (variant) => variant.aspectRatio === preset.aspectRatio,
    ),
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
  const outpaintEstimatedCostCents = estimateSceneOutpaintCost({
    prompt: renderSceneOutpaintPrompt({
      aspectRatio: selectedVariant.aspectRatio,
      width: selectedVariant.width,
      height: selectedVariant.height,
    }),
    aspectRatio: selectedVariant.aspectRatio,
  });
  const withinDurationLimit =
    ready &&
    validateRenderDuration({
      durationMilliseconds: totalDurationMilliseconds,
      maxRenderDurationSeconds: effectiveLimits.maxRenderDurationSeconds,
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
  const effectiveBudget = await loadEffectiveWorkspaceBudget({
    workspaceId: input.workspaceId,
  });
  const availableBudgetCents = calculateAvailableSceneImageBudgetCents({
    projectLimitCents: input.project.maximumBudgetCents,
    projectCommittedCents,
    workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
    workspaceDailyCommittedCents,
    workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
    workspaceMonthlyCommittedCents,
  });

  const exports = renders.map(toExportView);
  const activeRender =
    exports.find((render) => ACTIVE_STATUSES.has(render.status)) ?? null;
  const imageByVersion = new Map(
    approvedImages.map((image) => [image.sceneVersionId, image]),
  );
  // When the output variant's target size equals the project's own canonical
  // size, the primary approved image already IS the native match (no extra
  // query was made above) — otherwise use the separately-fetched native set.
  const nativeVersionIds =
    nativeSize === canonicalSize
      ? new Set(
          approvedImages
            .filter((image) => image.assetObjectKey)
            .map((image) => image.sceneVersionId),
        )
      : new Set(
          nativeImages
            .filter((image) => image.assetObjectKey)
            .map((image) => image.sceneVersionId),
        );
  const framingByVersion = new Map(
    storedFramings.map((framing) => [framing.sceneVersionId, framing]),
  );
  const adaptedImageById = new Map(
    adaptedImages.map((image) => [image.id, image] as const),
  );
  const latestOutpaintByVersion = new Map<string, (typeof outpaints)[number]>();
  for (const outpaint of outpaints)
    if (!latestOutpaintByVersion.has(outpaint.sceneVersionId))
      latestOutpaintByVersion.set(outpaint.sceneVersionId, outpaint);
  const sceneFramings = currentScenes.flatMap(({ scene, version }) => {
    const image = imageByVersion.get(version.id);
    if (!image?.assetObjectKey) return [];
    const stored = framingByVersion.get(version.id);
    const adapted = stored
      ? adaptedImageById.get(stored.sourceImageGenerationId)
      : null;
    const framing =
      stored &&
      (stored.sourceImageGenerationId === image.generationId || adapted)
        ? stored
        : DEFAULT_SCENE_FRAMING;
    const displayedGenerationId = adapted?.id ?? image.generationId;
    const latestOutpaint = latestOutpaintByVersion.get(version.id);
    return [
      {
        sceneId: scene.id,
        sceneVersionId: version.id,
        sceneNumber: scene.sceneNumber,
        sourceImageGenerationId: displayedGenerationId,
        approvedSourceImageGenerationId: image.generationId,
        mode: framing.mode,
        focalPointXBps: framing.focalPointXBps,
        focalPointYBps: framing.focalPointYBps,
        scaleBps: framing.scaleBps,
        backgroundColor: framing.backgroundColor,
        customized: Boolean(stored),
        outpaintStatus: toOutpaintStatus(latestOutpaint?.status),
        outpaintError: latestOutpaint?.safeErrorMessage ?? null,
        hasNativeMatch: nativeVersionIds.has(version.id),
      },
    ];
  });
  const shortSourceScenes = readyTimeline
    ? readyTimeline.scenes.map((scene) => ({
        sceneId: scene.sceneId,
        sceneVersionId: scene.sceneVersionId,
        sceneNumber: scene.sceneNumber,
        startMilliseconds: scene.startMilliseconds,
        endMilliseconds: scene.endMilliseconds,
        captionBoundariesMilliseconds: Array.from(
          new Set(
            scene.captions.flatMap((caption) => [
              caption.startMs,
              caption.endMs,
            ]),
          ),
        ).sort((left, right) => left - right),
      }))
    : [];
  const clipsByShort = new Map<string, typeof shortClipRows>();
  for (const clip of shortClipRows) {
    const clips = clipsByShort.get(clip.shortCompositionId) ?? [];
    clips.push(clip);
    clipsByShort.set(clip.shortCompositionId, clips);
  }
  const shorts = shortRows.map((short) => {
    const clips = clipsByShort.get(short.id) ?? [];
    return {
      id: short.id,
      name: short.name,
      status: short.status,
      outputVariantId: short.outputVariantId,
      clipCount: clips.length,
      durationMilliseconds: clips.reduce(
        (total, clip) =>
          total + (clip.sourceEndMilliseconds - clip.sourceStartMilliseconds),
        0,
      ),
      estimatedRenderCostCents: estimateRenderCostCents({
        durationMilliseconds: clips.reduce(
          (total, clip) =>
            total + (clip.sourceEndMilliseconds - clip.sourceStartMilliseconds),
          0,
        ),
        rates: {
          costPerMinuteCents: environment.VIDEO_RENDER_COST_PER_MINUTE_CENTS,
          minimumEstimateCents: environment.VIDEO_RENDER_MINIMUM_ESTIMATE_CENTS,
        },
      }),
      createdAt: short.createdAt.toISOString(),
    };
  });

  return {
    selectedOutputVariantId: selectedVariant.id,
    timeline,
    presets,
    configuration: {
      enabled: environment.ENABLE_VIDEO_RENDERING,
      maxRenderDurationSeconds: effectiveLimits.maxRenderDurationSeconds,
      estimatedCostCents,
      withinDurationLimit,
      watermarkAvailable: environment.VIDEO_WATERMARK_TEXT.length > 0,
      outpaintEstimatedCostCents,
    },
    sceneFramings,
    shortSourceScenes,
    shorts,
    exports,
    activeRender,
    availableBudgetCents,
  };
}
