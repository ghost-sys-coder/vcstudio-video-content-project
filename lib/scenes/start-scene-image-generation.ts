import "server-only";

import { tasks } from "@trigger.dev/sdk";
import {
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_IMAGE_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project } from "@/db/schema";
import {
  attachSceneImageTriggerRun,
  createSceneImageGenerationReservation,
} from "@/db/commands/scene-image-commands";
import {
  findApprovedCurrentSceneVersion,
  findEligibleSceneReferenceAssetsByIds,
  findPromptTemplateVersion,
  findSceneImageGenerationByRequestNonce,
  findStylePresetVersion,
  getNextSceneImageGenerationVersion,
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
  listAssignedSceneCharacters,
  listGenerationReferenceAssets,
} from "@/db/repositories/scene-images.repository";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import {
  createRequestFingerprint,
  createSceneImageIdempotencyKey,
} from "@/lib/domain/idempotency";
import { BudgetExceededError } from "@/lib/domain/errors";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { getOpenAiReferenceInputFidelitySnapshot } from "@/lib/openai/image-generation-request";
import {
  findSceneImageBudgetConstraint,
  getUtcBudgetWindowStarts,
  type SceneImageBudgetConstraint,
} from "@/lib/scenes/scene-image-budget";
import {
  createSceneImageOutputCostMatrix,
  getSceneImageCompression,
} from "@/lib/scenes/scene-image-configuration";
import { createSceneImagePromptPreview } from "@/lib/scenes/scene-image-prompt";
import type { StartSceneImageGenerationInput } from "@/lib/schemas/scene-image";
import type { sceneImageGenerationTask } from "@/trigger/scene-image-generation";

const SCENE_IMAGE_PROMPT_TEMPLATE_KEY = "scene-image";

async function dispatchSceneImageGeneration(input: {
  generationId: string;
  workspaceId: string;
  projectId: string;
  idempotencyKey: string;
}): Promise<"attached" | "ambiguous"> {
  let triggerRunId: string;
  try {
    const handle = await tasks.trigger<typeof sceneImageGenerationTask>(
      "scene-image-generation",
      {
        generationId: input.generationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    triggerRunId = handle.id;
  } catch {
    return "ambiguous";
  }

  try {
    await attachSceneImageTriggerRun({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      generationId: input.generationId,
      triggerRunId,
    });
  } catch {
    return "ambiguous";
  }
  return "attached";
}

export class SceneImageGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneImageGenerationRequestError";
  }
}

function referenceIdsMatch(left: string[], right: string[]): boolean {
  const orderedLeft = [...left].sort();
  const orderedRight = [...right].sort();
  return (
    orderedLeft.length === orderedRight.length &&
    orderedLeft.every((value, index) => value === orderedRight[index])
  );
}

function budgetErrorMessage(constraint: SceneImageBudgetConstraint): string {
  if (constraint === "project")
    return "This image generation would exceed the project budget.";
  if (constraint === "workspaceDaily")
    return "This image generation would exceed the workspace daily budget.";
  return "This image generation would exceed the workspace monthly budget.";
}

async function existingRequestMatches(input: {
  generation: NonNullable<
    Awaited<ReturnType<typeof findSceneImageGenerationByRequestNonce>>
  >;
  workspaceId: string;
  projectId: string;
  requestedByUserId: string;
  request: StartSceneImageGenerationInput;
  model: string;
  outputFormat: "webp" | "png" | "jpeg";
  outputCompression: number;
  background: "opaque" | "auto";
  inputFidelity: string | null;
}): Promise<boolean> {
  const storedReferences = await listGenerationReferenceAssets({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    generationId: input.generation.id,
  });
  return (
    input.generation.sceneId === input.request.sceneId &&
    input.generation.sceneVersionId === input.request.sceneVersionId &&
    input.generation.stylePresetVersionId ===
      input.request.stylePresetVersionId &&
    input.generation.requestedByUserId === input.requestedByUserId &&
    input.generation.model === input.model &&
    input.generation.quality === input.request.quality &&
    input.generation.size === input.request.size &&
    input.generation.outputFormat === input.outputFormat &&
    input.generation.outputCompression === input.outputCompression &&
    input.generation.background === input.background &&
    input.generation.inputFidelity === input.inputFidelity &&
    input.generation.promptTemplateVersion === SCENE_IMAGE_PROMPT_VERSION &&
    referenceIdsMatch(
      storedReferences.map(
        ({ reference }) => reference.referenceAssetIdSnapshot,
      ),
      input.request.referenceAssetIds,
    )
  );
}

export async function startSceneImageGeneration(input: {
  workspaceId: string;
  requestedByUserId: string;
  project: Project;
  request: StartSceneImageGenerationInput;
}): Promise<{ generationId: string; created: boolean }> {
  const environment = getSceneImageEnvironment();
  if (!environment.ENABLE_SCENE_IMAGE_GENERATION)
    throw new SceneImageGenerationRequestError(
      "Scene image generation is disabled.",
    );
  if (
    input.request.referenceAssetIds.length >
    environment.MAX_REFERENCE_ASSETS_PER_GENERATION
  )
    throw new SceneImageGenerationRequestError(
      `Select no more than ${environment.MAX_REFERENCE_ASSETS_PER_GENERATION} reference assets.`,
    );

  const approvedScene = await findApprovedCurrentSceneVersion({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    sceneId: input.request.sceneId,
    sceneVersionId: input.request.sceneVersionId,
  });
  if (!approvedScene)
    throw new SceneImageGenerationRequestError(
      "Approve the current scene version before generating an image.",
    );

  const outputCompression = getSceneImageCompression(
    environment,
    input.request.quality,
  );
  const inputFidelity = getOpenAiReferenceInputFidelitySnapshot({
    model: environment.OPENAI_IMAGE_MODEL,
    hasReferences: input.request.referenceAssetIds.length > 0,
  });
  const existingGeneration = await findSceneImageGenerationByRequestNonce({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    requestNonce: input.request.requestNonce,
  });
  if (existingGeneration) {
    const matches = await existingRequestMatches({
      generation: existingGeneration,
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      requestedByUserId: input.requestedByUserId,
      request: input.request,
      model: environment.OPENAI_IMAGE_MODEL,
      outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
      outputCompression,
      background: environment.OPENAI_IMAGE_BACKGROUND,
      inputFidelity,
    });
    if (!matches)
      throw new SceneImageGenerationRequestError(
        "This request identifier was already used for different image settings. Start a new generation.",
      );
    if (
      !existingGeneration.triggerRunId &&
      (existingGeneration.status === "pending" ||
        existingGeneration.status === "queued" ||
        existingGeneration.status === "running")
    )
      await dispatchSceneImageGeneration({
        generationId: existingGeneration.id,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        idempotencyKey: existingGeneration.idempotencyKey,
      });
    return { generationId: existingGeneration.id, created: false };
  }

  const [
    stylePreset,
    promptTemplate,
    selectedReferenceRows,
    assignedCharacterRows,
    initialGenerationVersion,
  ] = await Promise.all([
    findStylePresetVersion({
      workspaceId: input.workspaceId,
      stylePresetVersionId: input.request.stylePresetVersionId,
    }),
    findPromptTemplateVersion({
      templateKey: SCENE_IMAGE_PROMPT_TEMPLATE_KEY,
      version: SCENE_IMAGE_PROMPT_VERSION,
    }),
    findEligibleSceneReferenceAssetsByIds({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      sceneVersionId: input.request.sceneVersionId,
      referenceAssetIds: input.request.referenceAssetIds,
    }),
    listAssignedSceneCharacters({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      sceneVersionId: input.request.sceneVersionId,
      limit: 100,
    }),
    getNextSceneImageGenerationVersion({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      sceneVersionId: input.request.sceneVersionId,
    }),
  ]);
  if (!stylePreset)
    throw new SceneImageGenerationRequestError(
      "The selected style preset is unavailable.",
    );
  if (
    !promptTemplate ||
    promptTemplate.sourceHash !== SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH
  )
    throw new SceneImageGenerationRequestError(
      "The image prompt template is unavailable. Apply the Phase 5 database migration before generating images.",
    );
  if (
    selectedReferenceRows.length !== input.request.referenceAssetIds.length ||
    !referenceIdsMatch(
      selectedReferenceRows.map(({ reference }) => reference.id),
      input.request.referenceAssetIds,
    )
  )
    throw new SceneImageGenerationRequestError(
      "One or more selected references do not belong to this scene version.",
    );
  if (
    initialGenerationVersion >
    environment.MAX_IMAGE_GENERATIONS_PER_SCENE_VERSION
  )
    throw new SceneImageGenerationRequestError(
      "This scene version has reached its image generation limit.",
    );

  const finalPrompt = createSceneImagePromptPreview({
    stylePreset: {
      id: stylePreset.preset.id,
      versionId: stylePreset.version.id,
      name: stylePreset.version.name,
      description: stylePreset.version.description,
      version: stylePreset.version.version,
      isDefault: stylePreset.preset.isDefault,
      positivePrompt: stylePreset.version.positivePrompt,
      negativePrompt: stylePreset.version.negativePrompt,
      defaultAspectRatio: stylePreset.version.defaultAspectRatio,
    },
    characters: assignedCharacterRows.map(({ character }) => character),
    references: selectedReferenceRows.map(({ character, reference }) => ({
      id: reference.id,
      characterId: character.id,
      characterName: character.name,
      typeLabel: reference.type,
      referenceType: reference.type,
      thumbnailUrl: "",
      width: reference.width,
      height: reference.height,
    })),
    sceneVersion: approvedScene.version,
    size: input.request.size,
    aspectRatio: input.project.aspectRatio,
  });
  const estimate = estimateSceneImageCost({
    prompt: finalPrompt,
    quality: input.request.quality,
    size: input.request.size,
    referenceAssetCount: input.request.referenceAssetIds.length,
    outputCostMatrix: createSceneImageOutputCostMatrix(environment),
    textInputCostPerMillionCents:
      environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
    referenceInputReserveCents:
      environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
    safetyMarginBasisPoints: 0,
  });
  const { dailyWindowStart, monthlyWindowStart } = getUtcBudgetWindowStarts(
    new Date(),
  );
  const [
    projectCommittedCents,
    workspaceDailyCommittedCents,
    workspaceMonthlyCommittedCents,
  ] = await Promise.all([
    getProjectCommittedCostCents({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
    }),
    getWorkspaceCommittedCostCents({
      workspaceId: input.workspaceId,
      since: dailyWindowStart,
    }),
    getWorkspaceCommittedCostCents({
      workspaceId: input.workspaceId,
      since: monthlyWindowStart,
    }),
  ]);
  const budgetConstraint = findSceneImageBudgetConstraint({
    snapshot: {
      projectLimitCents: input.project.maximumBudgetCents,
      projectCommittedCents,
      workspaceDailyLimitCents: environment.DEFAULT_DAILY_BUDGET_CENTS,
      workspaceDailyCommittedCents,
      workspaceMonthlyLimitCents: environment.DEFAULT_MONTHLY_BUDGET_CENTS,
      workspaceMonthlyCommittedCents,
    },
    estimatedCostCents: estimate.estimatedCostCents,
  });
  if (budgetConstraint)
    throw new SceneImageGenerationRequestError(
      budgetErrorMessage(budgetConstraint),
    );

  const generationId = crypto.randomUUID();
  const reservationId = crypto.randomUUID();
  const stylePresetVersionIdentity = `${stylePreset.version.id}:${stylePreset.version.version}`;
  const requestFingerprint = createRequestFingerprint(
    environment.REQUEST_FINGERPRINT_SECRET,
    finalPrompt,
  );
  let generationVersion = initialGenerationVersion;
  let idempotencyKey = "";
  let reservation:
    | Awaited<ReturnType<typeof createSceneImageGenerationReservation>>
    | undefined;

  for (
    let reservationAttempt = 0;
    reservationAttempt < 2;
    reservationAttempt++
  ) {
    idempotencyKey = createSceneImageIdempotencyKey({
      secret: environment.IDEMPOTENCY_HASH_SECRET,
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      sceneVersionId: input.request.sceneVersionId,
      promptTemplateVersion: SCENE_IMAGE_PROMPT_VERSION,
      stylePresetVersion: stylePresetVersionIdentity,
      generationVersion,
      model: environment.OPENAI_IMAGE_MODEL,
      quality: input.request.quality,
      size: input.request.size,
      outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
      outputCompression,
      background: environment.OPENAI_IMAGE_BACKGROUND,
      referenceAssetIds: input.request.referenceAssetIds,
    });
    try {
      reservation = await createSceneImageGenerationReservation({
        generationId,
        reservationId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        sceneId: input.request.sceneId,
        sceneVersionId: input.request.sceneVersionId,
        stylePresetVersionId: stylePreset.version.id,
        promptTemplateVersionId: promptTemplate.id,
        generationVersion,
        requestNonce: input.request.requestNonce,
        idempotencyKey,
        requestFingerprint,
        model: environment.OPENAI_IMAGE_MODEL,
        quality: input.request.quality,
        size: input.request.size,
        outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
        outputCompression,
        background: environment.OPENAI_IMAGE_BACKGROUND,
        inputFidelity,
        promptTemplateKey: SCENE_IMAGE_PROMPT_TEMPLATE_KEY,
        promptTemplateVersion: SCENE_IMAGE_PROMPT_VERSION,
        stylePresetVersion: stylePreset.version.version,
        finalPrompt,
        estimatedCostCents: estimate.estimatedCostCents,
        requestedByUserId: input.requestedByUserId,
        expiresAt: new Date(
          Date.now() +
            environment.GENERATION_RESERVATION_EXPIRY_MINUTES * 60_000,
        ),
        budget: {
          workspaceDailyLimitCents: environment.DEFAULT_DAILY_BUDGET_CENTS,
          workspaceMonthlyLimitCents: environment.DEFAULT_MONTHLY_BUDGET_CENTS,
          dailyWindowStart,
          monthlyWindowStart,
        },
        referenceAssetIds: input.request.referenceAssetIds,
      });
      break;
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        const constraint: SceneImageBudgetConstraint =
          error.scope === "project"
            ? "project"
            : error.scope === "workspace_daily"
              ? "workspaceDaily"
              : "workspaceMonthly";
        throw new SceneImageGenerationRequestError(
          budgetErrorMessage(constraint),
        );
      }
      if (
        reservationAttempt === 0 &&
        error instanceof Error &&
        error.message === "SCENE_IMAGE_GENERATION_VERSION_CONFLICT"
      ) {
        generationVersion = await getNextSceneImageGenerationVersion({
          workspaceId: input.workspaceId,
          projectId: input.project.id,
          sceneVersionId: input.request.sceneVersionId,
        });
        if (
          generationVersion >
          environment.MAX_IMAGE_GENERATIONS_PER_SCENE_VERSION
        )
          throw new SceneImageGenerationRequestError(
            "This scene version has reached its image generation limit.",
          );
        continue;
      }
      throw error;
    }
  }
  if (!reservation) throw new Error("SCENE_IMAGE_RESERVATION_CREATE_FAILED");
  if (!reservation.created)
    return { generationId: reservation.generation.id, created: false };

  const dispatch = await dispatchSceneImageGeneration({
    generationId,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    idempotencyKey,
  });
  if (dispatch === "ambiguous")
    console.error(
      "The scene image Trigger dispatch could not be confirmed immediately; the reservation remains pending for safe reconciliation.",
      { generationId },
    );

  return { generationId, created: true };
}
