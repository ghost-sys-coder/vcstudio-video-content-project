import "server-only";

import { randomUUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import {
  renderSceneMotionPrompt,
  SCENE_MOTION_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project } from "@/db/schema";
import {
  attachSceneClipTriggerRun,
  createSceneClipGenerationReservation,
  ensureSceneMotionPromptTemplate,
} from "@/db/commands/scene-video-commands";
import { findPromptTemplateVersion } from "@/db/repositories/scene-images.repository";
import { getNextSceneClipGenerationVersion } from "@/db/repositories/scene-videos.repository";
import {
  findApprovedSceneAudioForVersion,
  listApprovedSceneImageAssets,
} from "@/db/repositories/subtitle.repository";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import {
  createRequestFingerprint,
  createSceneClipIdempotencyKey,
} from "@/lib/domain/idempotency";
import {
  getSceneImageEnvironment,
  getSceneVideoEnvironment,
} from "@/lib/env/server";
import { getUtcBudgetWindowStarts } from "@/lib/scenes/scene-image-budget";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";
import { planSceneClip } from "@/lib/video-models/plan-scene-clip";
import { createOpenAiVideoCapabilities } from "@/lib/video-models/openai-video-mapping";
import type { sceneVideoGenerationTask } from "@/trigger/scene-video-generation";

export class SceneClipNotPossibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneClipNotPossibleError";
  }
}

/**
 * Works out what a clip for this scene would be, and what it would cost.
 *
 * Separate from starting one, so the price and the loop warning can be shown
 * and refused before a paid generation exists. The narration's measured length
 * is what drives the plan: a clip has to cover the voice, and the voice is the
 * only thing that knows how long the scene is.
 */
export async function planSceneClipForScene(input: {
  workspaceId: string;
  project: Project;
  sceneId: string;
  sceneVersionId: string;
  motionDescription: string;
}) {
  const environment = getSceneVideoEnvironment();
  if (!environment.ENABLE_SCENE_VIDEO_GENERATION)
    throw new SceneClipNotPossibleError(
      "Scene clips are switched off for this deployment.",
    );

  const scope = {
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  };

  const [audio, stills] = await Promise.all([
    findApprovedSceneAudioForVersion({
      ...scope,
      sceneVersionId: input.sceneVersionId,
    }),
    listApprovedSceneImageAssets({
      ...scope,
      sceneVersionIds: [input.sceneVersionId],
      size: getSceneImageSizeForAspectRatio(input.project.aspectRatio),
    }),
  ]);

  if (!audio?.durationMilliseconds)
    throw new SceneClipNotPossibleError(
      "Generate this scene's narration first; the clip is built to cover it.",
    );

  // The scene's first still. A multi-image scene animates its opening image,
  // because a clip replaces the whole scene's visual and there is only one.
  const still = stills[0] ?? null;
  if (!still?.assetObjectKey)
    throw new SceneClipNotPossibleError(
      "Approve an image for this scene first; the clip is made from it.",
    );

  const capabilities = createOpenAiVideoCapabilities({
    costCentsPerSecond: environment.OPENAI_VIDEO_COST_PER_SECOND_CENTS,
  });

  const plan = planSceneClip({
    capabilities,
    mode: "imageToVideo",
    aspectRatio: input.project.aspectRatio,
    sceneDurationMilliseconds: audio.durationMilliseconds,
    hasApprovedStill: true,
  });
  if (plan.outcome === "refused")
    throw new SceneClipNotPossibleError(plan.reason);

  return {
    plan,
    still: {
      generationId: still.generationId,
      objectKey: still.assetObjectKey,
    },
    model: environment.OPENAI_VIDEO_MODEL,
  };
}

/**
 * Starts a clip: reserves the money, writes the row, hands it to the worker.
 *
 * Dispatch happens here rather than inside the task so a budget refusal reaches
 * the person who clicked, while they are still there to act on it, rather than
 * surfacing minutes later as a failed background run.
 */
export async function startSceneClipGeneration(input: {
  workspaceId: string;
  requestedByUserId: string;
  project: Project;
  sceneId: string;
  sceneVersionId: string;
  motionDescription: string;
  visualStyleSummary: string;
}) {
  const environment = getSceneVideoEnvironment();
  const imageEnvironment = getSceneImageEnvironment();
  const planned = await planSceneClipForScene(input);
  if (planned.plan.outcome !== "planned")
    throw new SceneClipNotPossibleError("This scene cannot be animated.");
  const plan = planned.plan;

  await ensureSceneMotionPromptTemplate();
  const promptTemplate = await findPromptTemplateVersion({
    templateKey: "scene-motion",
    version: SCENE_MOTION_PROMPT_VERSION,
  });
  if (!promptTemplate)
    throw new SceneClipNotPossibleError(
      "The motion prompt is unavailable on this deployment.",
    );

  const prompt = renderSceneMotionPrompt({
    motionDescription: input.motionDescription,
    visualStyleSummary: input.visualStyleSummary,
    durationSeconds: plan.durationSeconds,
    loops: plan.loopCount > 1,
  });

  const generationVersion = await getNextSceneClipGenerationVersion({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    sceneVersionId: input.sceneVersionId,
  });

  const idempotencyKey = createSceneClipIdempotencyKey({
    secret: imageEnvironment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    sceneVersionId: input.sceneVersionId,
    promptTemplateVersion: SCENE_MOTION_PROMPT_VERSION,
    generationVersion,
    provider: "openai",
    model: environment.OPENAI_VIDEO_MODEL,
    mode: "image_to_video",
    aspectRatio: plan.aspectRatio,
    durationSeconds: plan.durationSeconds,
    resolutionHeight: plan.resolutionHeight,
    sourceImageGenerationId: planned.still.generationId,
  });

  const budget = await loadEffectiveWorkspaceBudget({
    workspaceId: input.workspaceId,
  });
  const { dailyWindowStart, monthlyWindowStart } = getUtcBudgetWindowStarts(
    new Date(),
  );

  const { generation, created } = await createSceneClipGenerationReservation({
    generationId: randomUUID(),
    reservationId: randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    sceneId: input.sceneId,
    sceneVersionId: input.sceneVersionId,
    // Null is the project's own shape. Clips for other shapes are a later
    // concern; reframing a clip is not the same job as reframing a still.
    outputVariantId: null,
    sourceImageGenerationId: planned.still.generationId,
    mode: "image_to_video",
    provider: "openai",
    model: environment.OPENAI_VIDEO_MODEL,
    aspectRatio: plan.aspectRatio,
    resolutionHeight: plan.resolutionHeight,
    durationSeconds: plan.durationSeconds,
    loopCount: plan.loopCount,
    trimmed: plan.trimmed,
    motionDescription: input.motionDescription,
    promptTemplateVersionId: promptTemplate.id,
    promptTemplateVersion: SCENE_MOTION_PROMPT_VERSION,
    finalPrompt: prompt,
    generationVersion,
    requestNonce: randomUUID(),
    idempotencyKey,
    requestFingerprint: createRequestFingerprint(
      imageEnvironment.REQUEST_FINGERPRINT_SECRET,
      prompt,
    ),
    estimatedCostCents: plan.estimatedCostCents,
    requestedByUserId: input.requestedByUserId,
    expiresAt: new Date(
      Date.now() +
        imageEnvironment.GENERATION_RESERVATION_EXPIRY_MINUTES * 60_000,
    ),
    budget: {
      workspaceDailyLimitCents: budget.dailyBudgetCents,
      workspaceMonthlyLimitCents: budget.monthlyBudgetCents,
      dailyWindowStart,
      monthlyWindowStart,
    },
  });

  // An honest repeat returns the work already in flight rather than starting a
  // second paid job.
  if (!created) return { generation, plan, created: false as const };

  const handle = await tasks.trigger<typeof sceneVideoGenerationTask>(
    "scene-video-generation",
    {
      generationId: generation.id,
      workspaceId: input.workspaceId,
      projectId: input.project.id,
    },
    { idempotencyKey: `scene-clip-${generation.id}` },
  );
  await attachSceneClipTriggerRun({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    generationId: generation.id,
    triggerRunId: handle.id,
  });

  return { generation, plan, created: true as const };
}
