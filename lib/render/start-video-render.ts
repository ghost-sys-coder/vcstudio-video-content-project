import "server-only";

import { randomUUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import type { Project } from "@/db/schema";
import {
  attachVideoRenderTriggerRun,
  createVideoRenderReservation,
  failVideoRender,
} from "@/db/commands/video-render-commands";
import { countTerminalVideoRendersForTimeline } from "@/db/repositories/video-render.repository";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import {
  createRequestFingerprint,
  createVideoRenderIdempotencyKey,
} from "@/lib/domain/idempotency";
import { BudgetExceededError } from "@/lib/domain/errors";
import { getRenderEnvironment } from "@/lib/env/server";
import { buildRenderTimelineSnapshot } from "@/lib/render/build-render-snapshot";
import { defaultPresetForAspectRatio } from "@/lib/render/render-formats";
import { estimateRenderCostCents } from "@/lib/render/render-cost";
import { validateRenderDuration } from "@/lib/render/render-duration";
import {
  calculateAvailableSceneImageBudgetCents,
  getUtcBudgetWindowStarts,
} from "@/lib/scenes/scene-image-budget";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { loadEffectiveWorkspaceLimits } from "@/lib/budgets/current-settings";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import type { videoRenderTask } from "@/trigger/video-render";
import {
  buildOutputVariantTimelineContext,
  resolveProjectOutputVariant,
} from "@/lib/output-variants/output-variant-context";
import { findShortCompositionWithClips } from "@/db/repositories/shorts.repository";
import { buildShortTimeline } from "@/lib/shorts/short-timeline";

export class VideoRenderRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoRenderRequestError";
  }
}

export interface VideoRenderTimelineIssue {
  sceneNumber: number | null;
  message: string;
}

export class VideoRenderTimelineInvalidError extends Error {
  readonly issues: VideoRenderTimelineIssue[];
  constructor(issues: VideoRenderTimelineIssue[]) {
    super("The timeline is not ready to render.");
    this.name = "VideoRenderTimelineInvalidError";
    this.issues = issues;
  }
}

export interface StartVideoRenderResult {
  renderId: string;
  created: boolean;
  dispatched: boolean;
  estimatedCostCents: number;
  status: string;
}

/**
 * Freezes the current approved timeline into an immutable snapshot, reserves
 * the render's compute budget through the shared money-safe ledger, and
 * dispatches the durable render worker. Rebuilding the timeline here (rather
 * than trusting the browser) guarantees the render matches exactly what the
 * server considers approved.
 */
export async function startVideoRender(input: {
  workspaceId: string;
  requestedByUserId: string;
  project: Project;
  outputVariantId: string;
  shortCompositionId?: string;
  presetId?: string;
  includeCaptions: boolean;
  includeWatermark: boolean;
  requestNonce: string;
  now?: Date;
}): Promise<StartVideoRenderResult> {
  const environment = getRenderEnvironment();
  if (!environment.ENABLE_VIDEO_RENDERING)
    throw new VideoRenderRequestError("Video rendering is currently disabled.");
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "video_render",
    now: input.now,
  });

  const outputVariant = await resolveProjectOutputVariant({
    workspaceId: input.workspaceId,
    project: input.project,
    outputVariantId: input.outputVariantId,
  });
  const preset = defaultPresetForAspectRatio(outputVariant.aspectRatio);
  if (input.presetId && input.presetId !== preset.id)
    throw new VideoRenderRequestError(
      `This output renders at ${outputVariant.aspectRatio}; choose the ${preset.label} preset.`,
    );

  const context = await buildOutputVariantTimelineContext({
    workspaceId: input.workspaceId,
    project: input.project,
    outputVariant,
  });
  if (context.timeline.status !== "ready")
    throw new VideoRenderTimelineInvalidError(
      context.timeline.report.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => ({
          sceneNumber: issue.sceneNumber,
          message: issue.message,
        })),
    );

  let renderTimeline = context.timeline.timeline;
  if (input.shortCompositionId) {
    const short = await findShortCompositionWithClips({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      shortCompositionId: input.shortCompositionId,
    });
    if (!short || short.composition.outputVariantId !== outputVariant.id)
      throw new VideoRenderRequestError("The selected short was not found.");
    renderTimeline = buildShortTimeline({
      source: renderTimeline,
      clips: short.clips.map((clip) => ({
        id: clip.id,
        sourceSceneId: clip.sourceSceneId,
        sourceSceneVersionId: clip.sourceSceneVersionId,
        position: clip.position,
        sourceStartMilliseconds: clip.sourceStartMilliseconds,
        sourceEndMilliseconds: clip.sourceEndMilliseconds,
        transition: clip.transition === "fade" ? "fade" : "cut",
      })),
      width: outputVariant.width,
      height: outputVariant.height,
    }).timeline;
  }

  const snapshot = buildRenderTimelineSnapshot({
    timeline: renderTimeline,
    captionStyle: context.captionStyle,
    includeCaptions: input.includeCaptions,
    includeWatermark: input.includeWatermark,
  });

  const effectiveLimits = await loadEffectiveWorkspaceLimits({
    workspaceId: input.workspaceId,
  });
  const durationValidation = validateRenderDuration({
    durationMilliseconds: snapshot.totalDurationMilliseconds,
    maxRenderDurationSeconds: effectiveLimits.maxRenderDurationSeconds,
  });
  if (!durationValidation.ok)
    throw new VideoRenderRequestError(durationValidation.reason);

  const captionCount = snapshot.scenes.reduce(
    (sum, scene) => sum + scene.captions.length,
    0,
  );
  const estimatedCostCents = estimateRenderCostCents({
    durationMilliseconds: snapshot.totalDurationMilliseconds,
    rates: {
      costPerMinuteCents: environment.VIDEO_RENDER_COST_PER_MINUTE_CENTS,
      minimumEstimateCents: environment.VIDEO_RENDER_MINIMUM_ESTIMATE_CENTS,
    },
  });

  const now = input.now ?? new Date();
  const { dailyWindowStart, monthlyWindowStart } =
    getUtcBudgetWindowStarts(now);
  const effectiveBudget = await loadEffectiveWorkspaceBudget({
    workspaceId: input.workspaceId,
  });
  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };
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
    workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
    workspaceDailyCommittedCents,
    workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
    workspaceMonthlyCommittedCents,
  });
  if (estimatedCostCents > availableBudgetCents)
    throw new VideoRenderRequestError(
      "This render would exceed the available budget.",
    );

  const snapshotJson = JSON.stringify(snapshot);
  const timelineFingerprint = createRequestFingerprint(
    environment.REQUEST_FINGERPRINT_SECRET,
    snapshotJson,
  );
  // A render's idempotency key is derived from the timeline, so a second render
  // of an identical timeline is normally deduplicated. That is correct while a
  // render is in flight or has succeeded, but it must not permanently block a
  // retry after a render failed or was cancelled — otherwise the only way to
  // re-render an unchanged timeline is to delete the dead row. Advancing the
  // key by the number of prior terminal renders lets a retry through while
  // still deduping in-flight/succeeded renders and double submits (the latter
  // guarded separately by the per-click request nonce).
  const priorTerminalRenders = await countTerminalVideoRendersForTimeline({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    requestFingerprint: timelineFingerprint,
  });
  const idempotencyKey = createVideoRenderIdempotencyKey({
    secret: environment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    preset: preset.id,
    width: snapshot.width,
    height: snapshot.height,
    framesPerSecond: snapshot.framesPerSecond,
    includeCaptions: snapshot.includeCaptions,
    includeWatermark: snapshot.includeWatermark,
    timelineFingerprint,
    attempt: priorTerminalRenders,
  });

  const renderId = randomUUID();
  const reservationId = randomUUID();

  let reservation;
  try {
    reservation = await createVideoRenderReservation({
      renderId,
      reservationId,
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      outputVariantId: outputVariant.id,
      shortCompositionId: input.shortCompositionId,
      requestNonce: input.requestNonce,
      idempotencyKey,
      requestFingerprint: timelineFingerprint,
      preset: preset.id,
      aspectRatio: outputVariant.aspectRatio,
      width: snapshot.width,
      height: snapshot.height,
      framesPerSecond: snapshot.framesPerSecond,
      includeCaptions: snapshot.includeCaptions,
      includeWatermark: snapshot.includeWatermark,
      sceneCount: snapshot.scenes.length,
      captionCount,
      durationMilliseconds: snapshot.totalDurationMilliseconds,
      totalFrames: snapshot.totalFrames,
      timelineSnapshot: snapshot,
      estimatedCostCents,
      requestedByUserId: input.requestedByUserId,
      expiresAt: new Date(
        now.getTime() +
          environment.VIDEO_RENDER_RESERVATION_EXPIRY_MINUTES * 60_000,
      ),
      budget: {
        workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
        workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
        dailyWindowStart,
        monthlyWindowStart,
      },
    });
  } catch (error) {
    if (error instanceof BudgetExceededError)
      throw new VideoRenderRequestError(
        "This render would exceed the available budget.",
      );
    throw error;
  }

  if (reservation.created)
    await recordAuditEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.requestedByUserId,
      projectId: input.project.id,
      action: "render_started",
      targetType: "video_render",
      targetId: renderId,
      metadata: {
        preset: preset.id,
        estimatedCostCents,
        durationMilliseconds: snapshot.totalDurationMilliseconds,
      },
    });

  // An existing render for this exact timeline is reused rather than re-billed.
  if (!reservation.created)
    return {
      renderId: reservation.render.id,
      created: false,
      dispatched: reservation.render.triggerRunId !== null,
      estimatedCostCents: reservation.render.estimatedCostCents,
      status: reservation.render.status,
    };

  try {
    const handle = await tasks.trigger<typeof videoRenderTask>(
      "video-render",
      {
        renderId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      },
      { idempotencyKey },
    );
    await attachVideoRenderTriggerRun({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      renderId,
      triggerRunId: handle.id,
    });
  } catch (error) {
    // The reservation is already committed, so a failed dispatch must not be
    // swallowed into a success: that leaves a render stuck at "pending" with a
    // reserved-but-idle budget until the reservation expires, and the user sees
    // nothing happen. Release the reservation and surface a real error so the
    // render can be retried immediately.
    await failVideoRender({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      renderId,
      category: "dispatch_failed",
      safeErrorMessage: "The render could not be queued. Please try again.",
      providerBilled: false,
    }).catch(() => {});
    console.error("Failed to dispatch video render task.", {
      renderId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    throw new VideoRenderRequestError(
      "The render could not be queued. Please try again.",
    );
  }

  return {
    renderId,
    created: true,
    dispatched: true,
    estimatedCostCents,
    status: "queued",
  };
}
