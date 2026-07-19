import "server-only";

import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import {
  CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH,
  CHARACTER_REFERENCE_PROMPT_VERSION,
  renderCharacterReferencePrompt,
  type CharacterReferenceView,
} from "@studio/prompts";
import type { CharacterReferenceType } from "@/db/schema";
import { findCharacter } from "@/db/repositories/characters.repository";
import {
  findPromptTemplateVersion,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scene-images.repository";
import {
  countActiveCharacterReferenceGenerations,
  findCharacterReferenceGenerationByRequestNonce,
  getWorkspaceCharacterReferenceCommittedCents,
} from "@/db/repositories/character-reference-generation.repository";
import {
  CHARACTER_REFERENCE_PROMPT_TEMPLATE_KEY,
  attachCharacterReferenceTriggerRun,
  createCharacterReferenceGenerationReservation,
  ensureCharacterReferencePromptTemplate,
} from "@/db/commands/character-reference-generation.command";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import { BudgetExceededError } from "@/lib/domain/errors";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { getUtcBudgetWindowStarts } from "@/lib/scenes/scene-image-budget";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import type { characterReferenceGenerationTask } from "@/trigger/character-reference-generation";

// Portraits are workspace-scoped identity references, not scene stills; cap how
// many a single character can accumulate to keep spend and storage bounded.
export const MAX_CHARACTER_REFERENCE_GENERATIONS_PER_CHARACTER = 12;

// Only canonical identity views can be generated (expression/outfit/pose stay
// upload-only); each maps to a supported OpenAI portrait size.
const generatableReferenceViews: CharacterReferenceView[] = [
  "master",
  "front",
  "threeQuarter",
  "side",
  "fullBody",
];

const PORTRAIT_QUALITY = "medium" as const;

function portraitSize(view: CharacterReferenceView): "1024x1536" | "1024x1024" {
  return view === "fullBody" ? "1024x1536" : "1024x1024";
}

function portraitDimensions(size: "1024x1536" | "1024x1024") {
  return size === "1024x1536"
    ? { width: 1024, height: 1536 }
    : { width: 1024, height: 1024 };
}

export class CharacterReferenceGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterReferenceGenerationRequestError";
  }
}

function isGeneratableView(
  type: CharacterReferenceType,
): type is CharacterReferenceView {
  return (generatableReferenceViews as string[]).includes(type);
}

async function dispatch(input: {
  generationId: string;
  workspaceId: string;
  characterId: string;
  idempotencyKey: string;
}): Promise<void> {
  try {
    const handle = await tasks.trigger<typeof characterReferenceGenerationTask>(
      "character-reference-generation",
      {
        generationId: input.generationId,
        workspaceId: input.workspaceId,
        characterId: input.characterId,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    await attachCharacterReferenceTriggerRun({
      workspaceId: input.workspaceId,
      generationId: input.generationId,
      triggerRunId: handle.id,
    });
  } catch {
    console.error(
      "The character reference Trigger dispatch could not be confirmed; the generation remains queued for reconciliation.",
      { generationId: input.generationId },
    );
  }
}

export async function startCharacterReferenceGeneration(input: {
  workspaceId: string;
  requestedByUserId: string;
  characterId: string;
  referenceType: CharacterReferenceType;
  requestNonce: string;
}): Promise<{ generationId: string; created: boolean }> {
  const environment = getSceneImageEnvironment();
  if (!environment.ENABLE_SCENE_IMAGE_GENERATION)
    throw new CharacterReferenceGenerationRequestError(
      "Image generation is disabled.",
    );
  if (!isGeneratableView(input.referenceType))
    throw new CharacterReferenceGenerationRequestError(
      "Only master, front, three-quarter, side, and full-body portraits can be generated.",
    );

  const existing = await findCharacterReferenceGenerationByRequestNonce({
    workspaceId: input.workspaceId,
    requestNonce: input.requestNonce,
  });
  if (existing)
    return { generationId: existing.id, created: existing.status !== "failed" };

  const character = await findCharacter({
    workspaceId: input.workspaceId,
    characterId: input.characterId,
  });
  if (!character || character.status === "archived")
    throw new CharacterReferenceGenerationRequestError(
      "This character is unavailable.",
    );

  const activeCount = await countActiveCharacterReferenceGenerations({
    workspaceId: input.workspaceId,
    characterId: input.characterId,
  });
  if (activeCount >= MAX_CHARACTER_REFERENCE_GENERATIONS_PER_CHARACTER)
    throw new CharacterReferenceGenerationRequestError(
      "This character has reached its portrait generation limit.",
    );

  await ensureCharacterReferencePromptTemplate();
  const promptTemplate = await findPromptTemplateVersion({
    templateKey: CHARACTER_REFERENCE_PROMPT_TEMPLATE_KEY,
    version: CHARACTER_REFERENCE_PROMPT_VERSION,
  });
  if (
    !promptTemplate ||
    promptTemplate.sourceHash !==
      CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH
  )
    throw new CharacterReferenceGenerationRequestError(
      "The character reference prompt template is unavailable.",
    );

  const size = portraitSize(input.referenceType);
  const dimensions = portraitDimensions(size);
  const finalPrompt = renderCharacterReferencePrompt({
    character: {
      name: character.name,
      description: character.description,
      visualIdentity: character.visualIdentity,
      bodyProportions: character.bodyProportions,
      faceDescription: character.faceDescription,
      hairDescription: character.hairDescription,
      skinToneDescription: character.skinToneDescription,
      defaultOutfitDescription: character.defaultOutfitDescription,
      negativeConstraints: character.negativeConstraints,
    },
    referenceType: input.referenceType,
    output: dimensions,
  });

  const estimate = estimateSceneImageCost({
    prompt: finalPrompt,
    quality: PORTRAIT_QUALITY,
    size,
    referenceAssetCount: 0,
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
  const effectiveBudget = await loadEffectiveWorkspaceBudget({
    workspaceId: input.workspaceId,
  });
  const [dailyCommitted, monthlyCommitted, dailyPortraits, monthlyPortraits] =
    await Promise.all([
      getWorkspaceCommittedCostCents({
        workspaceId: input.workspaceId,
        since: dailyWindowStart,
      }),
      getWorkspaceCommittedCostCents({
        workspaceId: input.workspaceId,
        since: monthlyWindowStart,
      }),
      getWorkspaceCharacterReferenceCommittedCents({
        workspaceId: input.workspaceId,
        since: dailyWindowStart,
      }),
      getWorkspaceCharacterReferenceCommittedCents({
        workspaceId: input.workspaceId,
        since: monthlyWindowStart,
      }),
    ]);
  if (
    dailyCommitted + dailyPortraits + estimate.estimatedCostCents >
    effectiveBudget.dailyBudgetCents
  )
    throw new BudgetExceededError("workspace_daily");
  if (
    monthlyCommitted + monthlyPortraits + estimate.estimatedCostCents >
    effectiveBudget.monthlyBudgetCents
  )
    throw new BudgetExceededError("workspace_monthly");

  const generationId = crypto.randomUUID();
  const idempotencyKey = createHash("sha256")
    .update(
      [
        environment.IDEMPOTENCY_HASH_SECRET,
        "character-reference",
        input.workspaceId,
        input.characterId,
        input.referenceType,
        CHARACTER_REFERENCE_PROMPT_VERSION,
        environment.OPENAI_IMAGE_MODEL,
        size,
        PORTRAIT_QUALITY,
        input.requestNonce,
      ].join(":"),
    )
    .digest("hex");

  const { generation, created } =
    await createCharacterReferenceGenerationReservation({
      generationId,
      workspaceId: input.workspaceId,
      characterId: input.characterId,
      referenceType: input.referenceType,
      model: environment.OPENAI_IMAGE_MODEL,
      size,
      quality: PORTRAIT_QUALITY,
      outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
      outputCompression: environment.OPENAI_IMAGE_FINAL_COMPRESSION,
      background: environment.OPENAI_IMAGE_BACKGROUND,
      finalPrompt,
      promptTemplateVersion: CHARACTER_REFERENCE_PROMPT_VERSION,
      promptTemplateVersionId: promptTemplate.id,
      requestNonce: input.requestNonce,
      idempotencyKey,
      requestFingerprint: createRequestFingerprint(
        environment.REQUEST_FINGERPRINT_SECRET,
        finalPrompt,
      ),
      estimatedCostCents: estimate.estimatedCostCents,
      requestedByUserId: input.requestedByUserId,
      budget: {
        workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
        workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
        dailyWindowStart,
        monthlyWindowStart,
      },
    });
  if (!created) return { generationId: generation.id, created: false };

  await dispatch({
    generationId: generation.id,
    workspaceId: input.workspaceId,
    characterId: input.characterId,
    idempotencyKey,
  });
  return { generationId: generation.id, created: true };
}
