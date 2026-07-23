import "server-only";

import { tasks } from "@trigger.dev/sdk";
import {
  renderSceneOutpaintPrompt,
  SCENE_OUTPAINT_PROMPT_VERSION,
} from "@studio/prompts";
import type {
  Project,
  ProjectOutputVariant,
  SceneImageGeneration,
} from "@/db/schema";
import {
  attachSceneImageTriggerRun,
  createSceneImageGenerationReservation,
  ensureSceneOutpaintPromptTemplate,
} from "@/db/commands/scene-image-commands";
import {
  findPromptTemplateVersion,
  findStylePresetVersion,
  getNextSceneImageGenerationVersion,
} from "@/db/repositories/scene-images.repository";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import {
  createRequestFingerprint,
  createSceneImageIdempotencyKey,
} from "@/lib/domain/idempotency";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { getOpenAiReferenceInputFidelitySnapshot } from "@/lib/openai/image-generation-request";
import { getUtcBudgetWindowStarts } from "@/lib/scenes/scene-image-budget";
import {
  createSceneImageOutputCostMatrix,
  getSceneImageCompression,
} from "@/lib/scenes/scene-image-configuration";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";
import type { sceneImageGenerationTask } from "@/trigger/scene-image-generation";

export function estimateSceneOutpaintCost(input: {
  prompt: string;
  aspectRatio: ProjectOutputVariant["aspectRatio"];
}) {
  const environment = getSceneImageEnvironment();
  return estimateSceneImageCost({
    prompt: input.prompt,
    quality: "low",
    size: getSceneImageSizeForAspectRatio(input.aspectRatio),
    referenceAssetCount: 1,
    outputCostMatrix: createSceneImageOutputCostMatrix(environment),
    textInputCostPerMillionCents:
      environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
    referenceInputReserveCents:
      environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
    safetyMarginBasisPoints: 0,
  }).estimatedCostCents;
}

export async function startSceneOutpaint(input: {
  workspaceId: string;
  requestedByUserId: string;
  project: Project;
  outputVariant: ProjectOutputVariant;
  sourceGeneration: SceneImageGeneration;
  requestNonce: string;
}) {
  const environment = getSceneImageEnvironment();
  if (!environment.ENABLE_SCENE_IMAGE_GENERATION)
    throw new Error("Scene image generation is disabled.");
  await ensureSceneOutpaintPromptTemplate();

  const [stylePreset, promptTemplate, generationVersion, budget] =
    await Promise.all([
      findStylePresetVersion({
        workspaceId: input.workspaceId,
        stylePresetVersionId: input.sourceGeneration.stylePresetVersionId,
        includeArchived: true,
      }),
      findPromptTemplateVersion({
        templateKey: "scene-outpaint",
        version: SCENE_OUTPAINT_PROMPT_VERSION,
      }),
      getNextSceneImageGenerationVersion({
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        sceneVersionId: input.sourceGeneration.sceneVersionId,
      }),
      loadEffectiveWorkspaceBudget({ workspaceId: input.workspaceId }),
    ]);
  if (!stylePreset || !promptTemplate)
    throw new Error("The source image configuration is unavailable.");

  const prompt = renderSceneOutpaintPrompt({
    aspectRatio: input.outputVariant.aspectRatio,
    width: input.outputVariant.width,
    height: input.outputVariant.height,
  });
  const quality = "low" as const;
  const size = getSceneImageSizeForAspectRatio(input.outputVariant.aspectRatio);
  const compression = getSceneImageCompression(environment, quality);
  const estimatedCostCents = estimateSceneOutpaintCost({
    prompt,
    aspectRatio: input.outputVariant.aspectRatio,
  });
  const idempotencyKey = createSceneImageIdempotencyKey({
    secret: environment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    sceneVersionId: input.sourceGeneration.sceneVersionId,
    promptTemplateVersion: SCENE_OUTPAINT_PROMPT_VERSION,
    stylePresetVersion: `${stylePreset.version.id}:${stylePreset.version.version}`,
    generationVersion,
    model: environment.OPENAI_IMAGE_MODEL,
    quality,
    size,
    outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
    outputCompression: compression,
    background: environment.OPENAI_IMAGE_BACKGROUND,
    referenceAssetIds: [input.sourceGeneration.id, input.outputVariant.id],
  });
  const generationId = crypto.randomUUID();
  const { dailyWindowStart, monthlyWindowStart } = getUtcBudgetWindowStarts(
    new Date(),
  );
  const reservation = await createSceneImageGenerationReservation({
    generationId,
    reservationId: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    sceneId: input.sourceGeneration.sceneId,
    sceneVersionId: input.sourceGeneration.sceneVersionId,
    purpose: "variant_outpaint",
    outputVariantId: input.outputVariant.id,
    sourceImageGenerationId: input.sourceGeneration.id,
    stylePresetVersionId: stylePreset.version.id,
    promptTemplateVersionId: promptTemplate.id,
    generationVersion,
    requestNonce: input.requestNonce,
    idempotencyKey,
    requestFingerprint: createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      prompt,
    ),
    model: environment.OPENAI_IMAGE_MODEL,
    quality,
    size,
    outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
    outputCompression: compression,
    background: environment.OPENAI_IMAGE_BACKGROUND,
    inputFidelity: getOpenAiReferenceInputFidelitySnapshot({
      model: environment.OPENAI_IMAGE_MODEL,
      hasReferences: true,
    }),
    promptTemplateKey: "scene-outpaint",
    promptTemplateVersion: SCENE_OUTPAINT_PROMPT_VERSION,
    stylePresetVersion: stylePreset.version.version,
    finalPrompt: prompt,
    estimatedCostCents,
    requestedByUserId: input.requestedByUserId,
    expiresAt: new Date(
      Date.now() + environment.GENERATION_RESERVATION_EXPIRY_MINUTES * 60_000,
    ),
    budget: {
      workspaceDailyLimitCents: budget.dailyBudgetCents,
      workspaceMonthlyLimitCents: budget.monthlyBudgetCents,
      dailyWindowStart,
      monthlyWindowStart,
    },
    referenceAssetIds: [],
  });
  if (reservation.created) {
    const handle = await tasks.trigger<typeof sceneImageGenerationTask>(
      "scene-image-generation",
      {
        generationId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      },
      { idempotencyKey },
    );
    await attachSceneImageTriggerRun({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      generationId,
      triggerRunId: handle.id,
    });
  }
  return { generationId: reservation.generation.id, estimatedCostCents };
}
