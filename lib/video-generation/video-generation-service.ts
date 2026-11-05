import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { tasks } from "@trigger.dev/sdk";
import {
  DIRECT_VIDEO_PROMPT_VERSION,
  renderDirectVideoPrompt,
} from "@studio/prompts";
import {
  videoGenerationRequestSchema,
  videoGenerationStartSchema,
  type VideoGenerationRequest,
} from "@studio/contracts/video";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { getVideoGenerationEnvironment } from "@/lib/env/server";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import { findProject } from "@/db/repositories/projects.repository";
import { findApprovedSceneVideoReference } from "@/db/repositories/scene-video-reference.repository";
import {
  findVideoGeneration,
  findVideoGenerationByKey,
} from "@/db/repositories/video-generations.repository";
import {
  reserveVideoGeneration,
  updateVideoGeneration,
  settleVideoGeneration,
  VideoOperationError,
} from "@/db/commands/video-generation-commands";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { findVideoModel, findVideoPricing } from "./video-model-catalog";
import { planVideoGeneration } from "./plan-video-generation";
import {
  createVideoQuote,
  verifyVideoQuote,
  videoRequestDigest,
} from "./video-generation-quote";
import { getVideoSecurityEnvironment } from "./video-security";
import { videoProviderConfigured } from "./video-environment";
import { orderedVideoInputs } from "./video-input-order";
import type { videoGenerationTask } from "@/trigger/video-generation";

export async function authorizeVideoWorkspace(
  workspaceId: unknown,
  write = false,
) {
  const workspace = z.uuid().parse(workspaceId);
  const user = await requireAuthenticatedUser();
  const membership = await requireWorkspaceMembership({
    workspaceId: workspace,
    userId: user.id,
  });
  if (write) requireCapability(membership.role, "mutateWorkspaceData");
  return { workspaceId: workspace, userId: user.id, role: membership.role };
}
async function resolveVideoInputs(
  workspaceId: string,
  request: VideoGenerationRequest,
) {
  const assets = await Promise.all(
    request.inputs.map(async (input) => {
      if (input.source === "scene_image") {
        if (request.target.kind !== "scene")
          throw new VideoOperationError(
            "scene_required",
            "Project image references need a scene target.",
          );
        const reference = await findApprovedSceneVideoReference({
          workspaceId,
          projectId: request.target.projectId,
          sceneVersionId: request.target.sceneVersionId,
          generationId: input.assetId,
        });
        if (
          !reference?.objectKey ||
          !reference.contentType ||
          !reference.sizeBytes ||
          reference.sizeBytes > 10 * 1024 * 1024 ||
          !["image/png", "image/jpeg", "image/webp"].includes(
            reference.contentType,
          )
        )
          throw new VideoOperationError(
            "reference_unavailable",
            "The approved scene image is unavailable. Refresh the scene or choose a library image.",
          );
        return {
          assetId: reference.id,
          source: "scene_image" as const,
          objectKey: reference.objectKey,
          contentType: reference.contentType,
          sizeBytes: reference.sizeBytes,
          role: input.role,
        };
      }
      const asset = await findMediaAsset({
        workspaceId,
        mediaAssetId: input.assetId,
      });
      if (
        !asset ||
        asset.deletedAt ||
        asset.status !== "ready" ||
        asset.kind !== "image" ||
        asset.sizeBytes > 10 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(asset.contentType)
      )
        throw new VideoOperationError(
          "asset_unavailable",
          "Choose ready PNG, JPEG or WebP library images up to 10 MB each.",
        );
      return {
        assetId: asset.id,
        objectKey: asset.objectKey,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        role: input.role,
      };
    }),
  );
  if (
    assets.reduce((total, asset) => total + asset.sizeBytes, 0) >
    12 * 1024 * 1024
  )
    throw new VideoOperationError(
      "reference_size_limit",
      "Choose reference images totaling no more than 12 MB.",
    );
  if (request.target.kind === "scene") {
    const target = request.target;
    const [project, current] = await Promise.all([
      findProject({ workspaceId, projectId: target.projectId }),
      findCurrentScene({
        workspaceId,
        projectId: target.projectId,
        sceneId: target.sceneId,
      }),
    ]);
    if (
      !project ||
      project.archivedAt ||
      !current ||
      current.version.id !== target.sceneVersionId ||
      current.scene.currentVersion !== target.expectedSceneVersion
    )
      throw new VideoOperationError(
        "scene_changed",
        "The scene changed. Refresh it before generating.",
      );
    if (request.audio !== "none")
      throw new VideoOperationError(
        "project_narration",
        "Project footage uses the existing narration. Choose no native audio.",
      );
  }
  return assets;
}
export async function sceneStarterVideoReference(
  workspaceId: unknown,
  value: unknown,
) {
  const context = await authorizeVideoWorkspace(workspaceId, true);
  const input = z
    .object({ projectId: z.uuid(), sceneId: z.uuid() })
    .strict()
    .parse(value);
  const current = await findCurrentScene({ ...context, ...input });
  if (!current)
    throw new VideoOperationError(
      "scene_unavailable",
      "The current scene could not be found.",
    );
  const image = await findApprovedSceneVideoReference({
    ...context,
    projectId: input.projectId,
    sceneVersionId: current.version.id,
  });
  if (!image)
    throw new VideoOperationError(
      "image_unavailable",
      "Approve a still image for this scene first, or choose an image from the library.",
    );
  return {
    assetId: image.id,
    sceneVersionId: current.version.id,
    title: `Scene ${current.scene.sceneNumber} approved image`,
  };
}
async function planAuthorizedRequest(
  context: { workspaceId: string; userId: string },
  request: VideoGenerationRequest,
) {
  const environment = getVideoGenerationEnvironment();
  if (!environment.ENABLE_VIDEO_GENERATION)
    throw new VideoOperationError(
      "feature_disabled",
      "Video generation is paused on this deployment.",
    );
  const model = findVideoModel(request.modelId);
  if (!model || !videoProviderConfigured(model.provider, environment))
    throw new VideoOperationError(
      "provider_not_configured",
      "This model is not configured. Choose an available model.",
    );
  const pricing = findVideoPricing(
    model.id,
    environment.VIDEO_GENERATION_PRICING_JSON,
  );
  const plan = planVideoGeneration({ request, model, pricing });
  if (!pricing)
    throw new VideoOperationError(
      "pricing_unavailable",
      "Pricing must be configured before generation.",
    );
  if (plan.estimatedCostCents > environment.VIDEO_GENERATION_MAX_COST_CENTS)
    throw new VideoOperationError(
      "operation_budget",
      "This estimate exceeds the video spending limit. Choose a smaller resolution or shorter clip.",
    );
  const assets = await resolveVideoInputs(context.workspaceId, plan.request);
  const quoteContext = {
    ...context,
    request: plan.request,
    assetsDigest: videoRequestDigest(assets),
    model,
    pricing,
    maximumCostCents: plan.estimatedCostCents,
    secret: getVideoSecurityEnvironment().IDEMPOTENCY_HASH_SECRET,
  };
  return { environment, plan, assets, model, pricing, quoteContext };
}
export async function quoteVideoGeneration(
  workspaceId: unknown,
  value: unknown,
) {
  const context = await authorizeVideoWorkspace(workspaceId, true);
  const planned = await planAuthorizedRequest(
    context,
    videoGenerationRequestSchema.parse(value),
  );
  return {
    ...createVideoQuote(planned.quoteContext),
    durationControl: planned.plan.durationControl,
    reservationDurationSeconds: planned.plan.reservationDurationSeconds,
  };
}
async function dispatchVideo(
  workspaceId: string,
  generationId: string,
  resume = false,
) {
  try {
    const handle = await tasks.trigger<typeof videoGenerationTask>(
      "video-generation",
      { workspaceId, generationId },
      {
        idempotencyKey: resume
          ? `video-resume:${generationId}:${Math.floor(Date.now() / 300000)}`
          : `video:${generationId}`,
      },
    );
    await updateVideoGeneration({
      workspaceId,
      generationId,
      from: ["queued", "running", "requires_reconciliation", "inspecting"],
      values: { triggerRunId: handle.id },
    });
    return { id: generationId, dispatched: true };
  } catch {
    // Dispatch can succeed even if the web request times out. Never refund or
    // create another provider job here; the existing row is the recovery handle.
    await updateVideoGeneration({
      workspaceId,
      generationId,
      from: ["queued"],
      values: {
        safeErrorMessage:
          "Worker dispatch has not been confirmed. Refresh status or resume this existing request; do not create a duplicate.",
      },
    }).catch(() => {
      console.error("Video dispatch acknowledgement could not be recorded", {
        generationId,
      });
    });
    return { id: generationId, dispatched: false };
  }
}
export async function startVideoGeneration(
  workspaceId: unknown,
  value: unknown,
) {
  const context = await authorizeVideoWorkspace(workspaceId, true);
  const input = videoGenerationStartSchema.parse(value);
  const fingerprint = videoRequestDigest(input.request);
  const existing = await findVideoGenerationByKey({
    ...context,
    idempotencyKey: input.idempotencyKey,
  });
  if (existing) {
    if (
      existing.requestFingerprint !== fingerprint ||
      existing.requestedByUserId !== context.userId
    )
      throw new VideoOperationError(
        "idempotency_conflict",
        "This request key belongs to a different request.",
      );
    return { id: existing.id, dispatched: Boolean(existing.triggerRunId) };
  }
  const planned = await planAuthorizedRequest(context, input.request);
  const quote = verifyVideoQuote({
    ...planned.quoteContext,
    token: input.quoteToken,
  });
  const budget = await loadEffectiveWorkspaceBudget(context);
  const finalPrompt =
    planned.model.provider === "google_gemini"
      ? renderDirectVideoPrompt({
          prompt: input.request.prompt,
          durationSeconds: input.request.durationSeconds,
          roles: orderedVideoInputs(
            input.request.mode,
            input.request.inputs,
          ).map((asset) => asset.role),
        })
      : input.request.prompt;
  const reservation = await reserveVideoGeneration({
    id: randomUUID(),
    reservationId: randomUUID(),
    ...context,
    quoteId: quote.quoteId,
    idempotencyKey: input.idempotencyKey,
    fingerprint,
    request: planned.plan.request,
    model: planned.model,
    pricing: planned.pricing,
    inputAssets: planned.assets,
    finalPrompt,
    promptTemplateVersion:
      planned.model.provider === "google_gemini"
        ? DIRECT_VIDEO_PROMPT_VERSION
        : "user-video-v1",
    estimatedCostCents: planned.plan.estimatedCostCents,
    dailyBudgetCents: budget.dailyBudgetCents,
    monthlyBudgetCents: budget.monthlyBudgetCents,
    videoDailyBudgetCents:
      planned.environment.VIDEO_GENERATION_DAILY_BUDGET_CENTS,
    videoLifetimeBudgetCents:
      planned.environment.VIDEO_GENERATION_LIFETIME_BUDGET_CENTS,
    maximumCostCents: planned.environment.VIDEO_GENERATION_MAX_COST_CENTS,
  });
  if (reservation.created)
    await recordAuditEvent({
      ...context,
      actorUserId: context.userId,
      action: "generation_started",
      targetType: "video_generation",
      targetId: reservation.id,
      metadata: {
        model: planned.model.id,
        estimatedCostCents: planned.plan.estimatedCostCents,
      },
    });
  return dispatchVideo(context.workspaceId, reservation.id);
}
export async function resumeVideoGeneration(
  workspaceId: unknown,
  generationId: unknown,
) {
  const context = await authorizeVideoWorkspace(workspaceId, true);
  const id = z.uuid().parse(generationId);
  const job = await findVideoGeneration({ ...context, generationId: id });
  if (!job)
    throw new VideoOperationError("not_found", "Video request was not found.");
  if (!getVideoGenerationEnvironment().ENABLE_VIDEO_GENERATION)
    throw new VideoOperationError(
      "feature_disabled",
      "Video generation is paused.",
    );
  if (
    job.status !== "queued" &&
    !(
      job.providerJobId &&
      (["running", "inspecting", "requires_reconciliation"].includes(
        job.status,
      ) ||
        (job.status === "succeeded" && job.actualCostCents === null))
    )
  )
    throw new VideoOperationError(
      "cannot_resume",
      "This request cannot be safely resumed. Its existing submission must be reconciled first.",
    );
  return dispatchVideo(context.workspaceId, id, true);
}
export async function cancelQueuedVideoGeneration(
  workspaceId: unknown,
  generationId: unknown,
) {
  const context = await authorizeVideoWorkspace(workspaceId, true);
  const id = z.uuid().parse(generationId);
  const job = await updateVideoGeneration({
    ...context,
    generationId: id,
    from: ["queued"],
    values: {
      status: "cancelled",
      completedAt: new Date(),
      safeErrorMessage: "Cancelled before provider submission.",
    },
  });
  if (!job)
    throw new VideoOperationError(
      "already_started",
      "The provider submission has already started. Cancellation cannot be guaranteed.",
    );
  await settleVideoGeneration({
    ...context,
    generationId: id,
    actualCostCents: 0,
  });
  await recordAuditEvent({
    ...context,
    actorUserId: context.userId,
    action: "generation_cancelled",
    targetType: "video_generation",
    targetId: id,
  });
  return { id };
}
