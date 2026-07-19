import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import {
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_IMAGE_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project } from "@/db/schema";
import {
  createSceneImageBatch,
  markSceneImageBatchDispatched,
} from "@/db/commands/scene-image-batch-commands";
import { createSceneImageGenerationReservation } from "@/db/commands/scene-image-commands";
import { listSceneImageGenerationsByBatch } from "@/db/repositories/scene-image-batches.repository";
import {
  findApprovedCurrentSceneVersion,
  findPromptTemplateVersion,
  findStylePresetVersion,
  getNextSceneImageGenerationVersion,
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
  listAssignedSceneCharacters,
  listEligibleSceneReferenceAssets,
  listSceneImageGenerationsForSceneVersions,
} from "@/db/repositories/scene-images.repository";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  createRequestFingerprint,
  createSceneImageIdempotencyKey,
} from "@/lib/domain/idempotency";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { getOpenAiReferenceInputFidelitySnapshot } from "@/lib/openai/image-generation-request";
import {
  calculateAvailableSceneImageBudgetCents,
  getUtcBudgetWindowStarts,
} from "@/lib/scenes/scene-image-budget";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { loadEffectiveWorkspaceLimits } from "@/lib/budgets/current-settings";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import {
  createSceneImageOutputCostMatrix,
  getSceneImageCompression,
} from "@/lib/scenes/scene-image-configuration";
import { createSceneImagePromptPreview } from "@/lib/scenes/scene-image-prompt";
import { classifySceneBulkEligibility } from "@/lib/scenes/scene-image-eligibility";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";
import type { StartBulkSceneImageGenerationInput } from "@/lib/schemas/bulk-scene-image";
import type { sceneImageGenerationTask } from "@/trigger/scene-image-generation";

const SCENE_IMAGE_PROMPT_TEMPLATE_KEY = "scene-image";

export class BulkSceneImageGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkSceneImageGenerationRequestError";
  }
}

export type BulkSceneImageGenerationResult = {
  batchId: string;
  created: boolean;
  reservedCount: number;
  requestedCount: number;
  skippedCount: number;
  dispatched: boolean;
  budgetStopped: boolean;
};

type DispatchItem = {
  payload: { generationId: string; workspaceId: string; projectId: string };
  options: { idempotencyKey: string };
};

function deterministicSceneNonce(batchId: string, sceneId: string): string {
  const value = createHash("sha256")
    .update(`scene-image-batch:${batchId}:${sceneId}`)
    .digest("hex")
    .slice(0, 32);
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join("-");
}

async function dispatchBatchItems(items: DispatchItem[]): Promise<boolean> {
  if (items.length === 0) return false;
  try {
    await tasks.batchTrigger<typeof sceneImageGenerationTask>(
      "scene-image-generation",
      items.map((item) => ({
        payload: item.payload,
        options: { idempotencyKey: item.options.idempotencyKey },
      })),
    );
    return true;
  } catch {
    return false;
  }
}

export async function startBulkSceneImageGeneration(input: {
  workspaceId: string;
  requestedByUserId: string;
  project: Project;
  request: StartBulkSceneImageGenerationInput;
  now?: Date;
}): Promise<BulkSceneImageGenerationResult> {
  const environment = getSceneImageEnvironment();
  if (!environment.ENABLE_SCENE_IMAGE_GENERATION)
    throw new BulkSceneImageGenerationRequestError(
      "Scene image generation is disabled.",
    );
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "scene_image_generation",
    now: input.now,
  });

  const requestedSceneIds = [...new Set(input.request.sceneIds)];
  if (requestedSceneIds.length === 0)
    throw new BulkSceneImageGenerationRequestError(
      "Select at least one scene.",
    );
  const limits = await loadEffectiveWorkspaceLimits({
    workspaceId: input.workspaceId,
  });
  if (requestedSceneIds.length > limits.maxImagesPerBatch)
    throw new BulkSceneImageGenerationRequestError(
      `Generate no more than ${limits.maxImagesPerBatch} scenes in a single batch.`,
    );

  const scope = {
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  };
  const size = getSceneImageSizeForAspectRatio(input.project.aspectRatio);
  const outputCompression = getSceneImageCompression(
    environment,
    input.request.quality,
  );

  const [stylePreset, promptTemplate, currentScenes] = await Promise.all([
    findStylePresetVersion({
      workspaceId: input.workspaceId,
      stylePresetVersionId: input.request.stylePresetVersionId,
    }),
    findPromptTemplateVersion({
      templateKey: SCENE_IMAGE_PROMPT_TEMPLATE_KEY,
      version: SCENE_IMAGE_PROMPT_VERSION,
    }),
    listCurrentScenes(scope),
  ]);
  if (!stylePreset)
    throw new BulkSceneImageGenerationRequestError(
      "The selected style preset is unavailable.",
    );
  if (
    !promptTemplate ||
    promptTemplate.sourceHash !== SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH
  )
    throw new BulkSceneImageGenerationRequestError(
      "The image prompt template is unavailable. Apply the latest database migration before generating images.",
    );

  const sceneById = new Map(
    currentScenes.map((row) => [row.scene.id, row] as const),
  );
  const generations = await listSceneImageGenerationsForSceneVersions({
    ...scope,
    sceneVersionIds: currentScenes.map((row) => row.version.id),
  });
  const latestByScene = new Map<string, (typeof generations)[number]>();
  const approvedByScene = new Set<string>();
  for (const generation of generations) {
    const row = sceneById.get(generation.sceneId);
    if (!row || generation.sceneVersionId !== row.version.id) continue;
    if (!latestByScene.has(generation.sceneId))
      latestByScene.set(generation.sceneId, generation);
    if (
      generation.status === "succeeded" &&
      generation.reviewStatus === "approved"
    )
      approvedByScene.add(generation.sceneId);
  }

  const plannedScenes: Array<(typeof currentScenes)[number]> = [];
  for (const sceneId of requestedSceneIds) {
    const row = sceneById.get(sceneId);
    if (!row) continue;
    const eligibility = classifySceneBulkEligibility({
      sceneStatus: row.scene.status,
      hasApprovedImage: approvedByScene.has(sceneId),
      latestGenerationStatus: latestByScene.get(sceneId)?.status ?? null,
    });
    if (eligibility === "eligible" || eligibility === "hasApprovedImage")
      plannedScenes.push(row);
  }
  if (plannedScenes.length === 0)
    throw new BulkSceneImageGenerationRequestError(
      "None of the selected scenes are eligible for generation right now.",
    );

  const outputCostMatrix = createSceneImageOutputCostMatrix(environment);
  const stylePresetView = {
    id: stylePreset.preset.id,
    versionId: stylePreset.version.id,
    name: stylePreset.version.name,
    description: stylePreset.version.description,
    version: stylePreset.version.version,
    isDefault: stylePreset.preset.isDefault,
    positivePrompt: stylePreset.version.positivePrompt,
    negativePrompt: stylePreset.version.negativePrompt,
    defaultAspectRatio: stylePreset.version.defaultAspectRatio,
  };

  const plans = await Promise.all(
    plannedScenes.map(async (row) => {
      const [assignedCharacterRows, referenceRows] = await Promise.all([
        listAssignedSceneCharacters({
          ...scope,
          sceneVersionId: row.version.id,
          limit: 100,
        }),
        listEligibleSceneReferenceAssets({
          ...scope,
          sceneVersionId: row.version.id,
          limit: environment.MAX_REFERENCE_ASSETS_PER_GENERATION,
        }),
      ]);
      const referenceAssetIds = referenceRows
        .slice(0, environment.MAX_REFERENCE_ASSETS_PER_GENERATION)
        .map(({ reference }) => reference.id)
        .sort();
      const finalPrompt = createSceneImagePromptPreview({
        stylePreset: stylePresetView,
        characters: assignedCharacterRows.map(({ character }) => character),
        references: referenceRows
          .slice(0, environment.MAX_REFERENCE_ASSETS_PER_GENERATION)
          .map(({ character, reference }) => ({
            id: reference.id,
            characterId: character.id,
            characterName: character.name,
            typeLabel: reference.type,
            referenceType: reference.type,
            thumbnailUrl: "",
            width: reference.width,
            height: reference.height,
          })),
        sceneVersion: row.version,
        size,
        aspectRatio: input.project.aspectRatio,
      });
      const estimate = estimateSceneImageCost({
        prompt: finalPrompt,
        quality: input.request.quality,
        size,
        referenceAssetCount: referenceAssetIds.length,
        outputCostMatrix,
        textInputCostPerMillionCents:
          environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
        referenceInputReserveCents:
          environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
        safetyMarginBasisPoints: 0,
      });
      const inputFidelity = getOpenAiReferenceInputFidelitySnapshot({
        model: environment.OPENAI_IMAGE_MODEL,
        hasReferences: referenceAssetIds.length > 0,
      });
      return {
        row,
        referenceAssetIds,
        finalPrompt,
        estimatedCostCents: estimate.estimatedCostCents,
        inputFidelity,
      };
    }),
  );

  const estimatedTotalCents = plans.reduce(
    (total, plan) => total + plan.estimatedCostCents,
    0,
  );
  const now = input.now ?? new Date();
  const { dailyWindowStart, monthlyWindowStart } =
    getUtcBudgetWindowStarts(now);
  const effectiveBudget = await loadEffectiveWorkspaceBudget({
    workspaceId: scope.workspaceId,
  });
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
  if (estimatedTotalCents > availableBudgetCents)
    throw new BulkSceneImageGenerationRequestError(
      "This batch would exceed the available budget. Reduce the number of scenes or lower the quality.",
    );

  const batchId = randomUUID();
  const { batch, created } = await createSceneImageBatch({
    batchId,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    requestNonce: input.request.requestNonce,
    stylePresetVersionId: stylePreset.version.id,
    quality: input.request.quality,
    size,
    requestedSceneCount: plans.length,
    estimatedCostCents: estimatedTotalCents,
    requestedByUserId: input.requestedByUserId,
  });

  if (batch.status === "cancelled")
    return {
      batchId: batch.id,
      created,
      reservedCount: batch.reservedSceneCount,
      requestedCount: plans.length,
      skippedCount: requestedSceneIds.length - plans.length,
      dispatched: false,
      budgetStopped: false,
    };

  if (!created) {
    const existing = await listSceneImageGenerationsByBatch({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      batchId: batch.id,
    });
    const pendingItems: DispatchItem[] = existing
      .filter(
        (generation) =>
          generation.status === "pending" || generation.status === "queued",
      )
      .map((generation) => ({
        payload: {
          generationId: generation.id,
          workspaceId: input.workspaceId,
          projectId: input.project.id,
        },
        options: { idempotencyKey: generation.idempotencyKey },
      }));
    const dispatched = await dispatchBatchItems(pendingItems);
    return {
      batchId: batch.id,
      created,
      reservedCount: batch.reservedSceneCount,
      requestedCount: plans.length,
      skippedCount: requestedSceneIds.length - plans.length,
      dispatched,
      budgetStopped: false,
    };
  }

  const items: DispatchItem[] = [];
  let budgetStopped = false;
  const stylePresetVersionIdentity = `${stylePreset.version.id}:${stylePreset.version.version}`;

  for (const plan of plans) {
    const approvedScene = await findApprovedCurrentSceneVersion({
      ...scope,
      sceneId: plan.row.scene.id,
      sceneVersionId: plan.row.version.id,
    });
    if (!approvedScene) continue;

    const requestNonce = deterministicSceneNonce(batchId, plan.row.scene.id);
    const requestFingerprint = createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      plan.finalPrompt,
    );
    let reserved = false;
    for (let attempt = 0; attempt < 2 && !reserved; attempt++) {
      const generationVersion = await getNextSceneImageGenerationVersion({
        ...scope,
        sceneVersionId: plan.row.version.id,
      });
      if (
        generationVersion > environment.MAX_IMAGE_GENERATIONS_PER_SCENE_VERSION
      )
        break;
      const generationId = randomUUID();
      const reservationId = randomUUID();
      const idempotencyKey = createSceneImageIdempotencyKey({
        secret: environment.IDEMPOTENCY_HASH_SECRET,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        sceneVersionId: plan.row.version.id,
        promptTemplateVersion: SCENE_IMAGE_PROMPT_VERSION,
        stylePresetVersion: stylePresetVersionIdentity,
        generationVersion,
        model: environment.OPENAI_IMAGE_MODEL,
        quality: input.request.quality,
        size,
        outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
        outputCompression,
        background: environment.OPENAI_IMAGE_BACKGROUND,
        referenceAssetIds: plan.referenceAssetIds,
      });
      try {
        const reservation = await createSceneImageGenerationReservation({
          generationId,
          reservationId,
          workspaceId: input.workspaceId,
          projectId: input.project.id,
          sceneId: plan.row.scene.id,
          sceneVersionId: plan.row.version.id,
          stylePresetVersionId: stylePreset.version.id,
          promptTemplateVersionId: promptTemplate.id,
          generationVersion,
          requestNonce,
          idempotencyKey,
          requestFingerprint,
          model: environment.OPENAI_IMAGE_MODEL,
          quality: input.request.quality,
          size,
          outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
          outputCompression,
          background: environment.OPENAI_IMAGE_BACKGROUND,
          inputFidelity: plan.inputFidelity,
          promptTemplateKey: SCENE_IMAGE_PROMPT_TEMPLATE_KEY,
          promptTemplateVersion: SCENE_IMAGE_PROMPT_VERSION,
          stylePresetVersion: stylePreset.version.version,
          finalPrompt: plan.finalPrompt,
          estimatedCostCents: plan.estimatedCostCents,
          requestedByUserId: input.requestedByUserId,
          batchId,
          expiresAt: new Date(
            now.getTime() +
              environment.GENERATION_RESERVATION_EXPIRY_MINUTES * 60_000,
          ),
          budget: {
            workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
            workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
            dailyWindowStart,
            monthlyWindowStart,
          },
          referenceAssetIds: plan.referenceAssetIds,
        });
        items.push({
          payload: {
            generationId: reservation.generation.id,
            workspaceId: input.workspaceId,
            projectId: input.project.id,
          },
          options: { idempotencyKey: reservation.generation.idempotencyKey },
        });
        reserved = true;
      } catch (error) {
        if (error instanceof BudgetExceededError) {
          budgetStopped = true;
          break;
        }
        if (
          attempt === 0 &&
          error instanceof Error &&
          error.message === "SCENE_IMAGE_GENERATION_VERSION_CONFLICT"
        )
          continue;
        throw error;
      }
    }
    if (budgetStopped) break;
  }

  await markSceneImageBatchDispatched({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    batchId,
    reservedSceneCount: items.length,
  });
  const dispatched = await dispatchBatchItems(items);

  return {
    batchId,
    created,
    reservedCount: items.length,
    requestedCount: plans.length,
    skippedCount: requestedSceneIds.length - plans.length,
    dispatched,
    budgetStopped,
  };
}
