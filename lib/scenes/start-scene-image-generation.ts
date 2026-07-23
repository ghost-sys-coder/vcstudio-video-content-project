import "server-only";

import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import {
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_IMAGE_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project } from "@/db/schema";
import {
  attachSceneImageTriggerRun,
  createSceneImageGenerationReservation,
  ensureSceneImagePromptTemplate,
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
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import {
  createSceneImageOutputCostMatrix,
  getSceneImageCompression,
} from "@/lib/scenes/scene-image-configuration";
import { createSceneImagePromptPreview } from "@/lib/scenes/scene-image-prompt";
import {
  getAspectRatioForSceneImageSize,
  type SceneImageApiSize,
  type StartSceneImageGenerationInput,
} from "@/lib/schemas/scene-image";
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

/**
 * One client-supplied nonce covers a whole multi-size click, but each size
 * needs its own globally-unique request nonce (the DB enforces uniqueness
 * per workspace, not per size). Deterministic so a double-submit of the same
 * click reproduces the same per-size nonces instead of double-charging.
 */
function deterministicSizeNonce(requestNonce: string, size: string): string {
  const value = createHash("sha256")
    .update(`scene-image-multi-size:${requestNonce}:${size}`)
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

async function existingRequestMatches(input: {
  generation: NonNullable<
    Awaited<ReturnType<typeof findSceneImageGenerationByRequestNonce>>
  >;
  workspaceId: string;
  projectId: string;
  requestedByUserId: string;
  request: StartSceneImageGenerationInput;
  size: SceneImageApiSize;
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
    input.generation.size === input.size &&
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

export type SceneImageGenerationStartResult = {
  size: SceneImageApiSize;
  generationId: string;
  created: boolean;
};

export type StartSceneImageGenerationResult = {
  started: SceneImageGenerationStartResult[];
  skippedSizes: SceneImageApiSize[];
};

/**
 * Starts an independent generation per requested size (each is a genuinely
 * separate OpenAI request/cost — sizes are never batched into one call).
 * Sizes are processed sequentially, not in parallel, so each reservation's
 * budget check sees the previous sizes' already-committed cost within this
 * same click. If budget or the per-scene-version generation cap is hit
 * partway through, already-started sizes are kept and the rest are reported
 * as skipped rather than discarding successful work; only throws when NOT
 * ONE requested size could be started.
 */
export async function startSceneImageGeneration(input: {
  workspaceId: string;
  requestedByUserId: string;
  project: Project;
  request: StartSceneImageGenerationInput;
}): Promise<StartSceneImageGenerationResult> {
  const environment = getSceneImageEnvironment();
  if (!environment.ENABLE_SCENE_IMAGE_GENERATION)
    throw new SceneImageGenerationRequestError(
      "Scene image generation is disabled.",
    );
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "scene_image_generation",
  });
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

  // Self-ensure the versioned prompt-template row so a newly bumped prompt
  // version works even when the schema was applied via `drizzle-kit push`
  // (which skips seed inserts).
  await ensureSceneImagePromptTemplate();

  const [
    stylePreset,
    promptTemplate,
    selectedReferenceRows,
    assignedCharacterRows,
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
      "The image prompt template is unavailable. Apply the latest database migration before generating images.",
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
  const referenceViews = selectedReferenceRows.map(
    ({ character, reference }) => ({
      id: reference.id,
      characterId: character.id,
      characterName: character.name,
      typeLabel: reference.type,
      referenceType: reference.type,
      thumbnailUrl: "",
      width: reference.width,
      height: reference.height,
    }),
  );
  const stylePresetVersionIdentity = `${stylePreset.version.id}:${stylePreset.version.version}`;
  const outputCostMatrix = createSceneImageOutputCostMatrix(environment);

  const started: SceneImageGenerationStartResult[] = [];
  const skippedSizes: SceneImageApiSize[] = [];
  let budgetConstraintReached: SceneImageBudgetConstraint | null = null;
  let limitReached = false;

  for (const size of input.request.sizes) {
    if (budgetConstraintReached || limitReached) {
      skippedSizes.push(size);
      continue;
    }

    const requestNonce = deterministicSizeNonce(
      input.request.requestNonce,
      size,
    );
    const existingGeneration = await findSceneImageGenerationByRequestNonce({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      requestNonce,
    });
    if (existingGeneration) {
      const matches = await existingRequestMatches({
        generation: existingGeneration,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        requestedByUserId: input.requestedByUserId,
        request: input.request,
        size,
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
      started.push({
        size,
        generationId: existingGeneration.id,
        created: false,
      });
      continue;
    }

    const finalPrompt = createSceneImagePromptPreview({
      stylePreset: stylePresetView,
      characters: assignedCharacterRows.map(({ character }) => character),
      references: referenceViews,
      sceneVersion: approvedScene.version,
      size,
      aspectRatio: getAspectRatioForSceneImageSize(size),
    });
    const estimate = estimateSceneImageCost({
      prompt: finalPrompt,
      quality: input.request.quality,
      size,
      referenceAssetCount: input.request.referenceAssetIds.length,
      outputCostMatrix,
      textInputCostPerMillionCents:
        environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
      referenceInputReserveCents:
        environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
      safetyMarginBasisPoints: 0,
    });
    const { dailyWindowStart, monthlyWindowStart } = getUtcBudgetWindowStarts(
      new Date(),
    );
    const effectiveBudget = await loadEffectiveWorkspaceBudget({
      workspaceId: input.workspaceId,
    });
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
        workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
        workspaceDailyCommittedCents,
        workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
        workspaceMonthlyCommittedCents,
      },
      estimatedCostCents: estimate.estimatedCostCents,
    });
    if (budgetConstraint) {
      budgetConstraintReached = budgetConstraint;
      skippedSizes.push(size);
      continue;
    }

    const generationId = crypto.randomUUID();
    const reservationId = crypto.randomUUID();
    const requestFingerprint = createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      finalPrompt,
    );
    let generationVersion = await getNextSceneImageGenerationVersion({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      sceneVersionId: input.request.sceneVersionId,
    });
    if (
      generationVersion > environment.MAX_IMAGE_GENERATIONS_PER_SCENE_VERSION
    ) {
      limitReached = true;
      skippedSizes.push(size);
      continue;
    }

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
        size,
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
          requestNonce,
          idempotencyKey,
          requestFingerprint,
          model: environment.OPENAI_IMAGE_MODEL,
          quality: input.request.quality,
          size,
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
            workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
            workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
            dailyWindowStart,
            monthlyWindowStart,
          },
          referenceAssetIds: input.request.referenceAssetIds,
        });
        break;
      } catch (error) {
        if (error instanceof BudgetExceededError) {
          budgetConstraintReached =
            error.scope === "project"
              ? "project"
              : error.scope === "workspace_daily"
                ? "workspaceDaily"
                : "workspaceMonthly";
          break;
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
          ) {
            limitReached = true;
            break;
          }
          continue;
        }
        throw error;
      }
    }

    if (!reservation) {
      skippedSizes.push(size);
      continue;
    }
    if (!reservation.created) {
      started.push({
        size,
        generationId: reservation.generation.id,
        created: false,
      });
      continue;
    }

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
    started.push({ size, generationId, created: true });
  }

  if (started.length === 0) {
    if (budgetConstraintReached)
      throw new SceneImageGenerationRequestError(
        budgetErrorMessage(budgetConstraintReached),
      );
    if (limitReached)
      throw new SceneImageGenerationRequestError(
        "This scene version has reached its image generation limit.",
      );
    throw new SceneImageGenerationRequestError(
      "The scene image generation could not be started.",
    );
  }

  return { started, skippedSizes };
}
