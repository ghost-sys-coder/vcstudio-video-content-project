import "server-only";

import { randomUUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import type { Project } from "@/db/schema";
import {
  attachVideoRenderTriggerRun,
  createVideoRenderReservation,
} from "@/db/commands/video-render-commands";
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
import { buildSubtitleContext } from "@/lib/subtitles/subtitle-workspace-details";
import type { videoRenderTask } from "@/trigger/video-render";

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

  const preset = defaultPresetForAspectRatio(input.project.aspectRatio);
  if (input.presetId && input.presetId !== preset.id)
    throw new VideoRenderRequestError(
      `This project renders at ${input.project.aspectRatio}; choose the ${preset.label} preset.`,
    );

  const context = await buildSubtitleContext({
    workspaceId: input.workspaceId,
    project: input.project,
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

  const snapshot = buildRenderTimelineSnapshot({
    timeline: context.timeline.timeline,
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
      requestNonce: input.requestNonce,
      idempotencyKey,
      requestFingerprint: timelineFingerprint,
      preset: preset.id,
      aspectRatio: input.project.aspectRatio,
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

  let dispatched = false;
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
    dispatched = true;
  } catch {
    dispatched = false;
  }

  return {
    renderId,
    created: true,
    dispatched,
    estimatedCostCents,
    status: "queued",
  };
}
