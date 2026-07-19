import "server-only";

import type { CharacterReferenceType, Project } from "@/db/schema";
import { ensureDefaultStylePreset } from "@/db/commands/ensure-default-style-preset.command";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
  listEligibleSceneReferenceAssets,
  listGenerationReferenceAssetsForGenerations,
  listLatestStylePresetVersions,
  listSceneImageGenerationSummaries,
} from "@/db/repositories/scene-images.repository";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import { getSceneImageEnvironment } from "@/lib/env/server";
import {
  calculateAvailableSceneImageBudgetCents,
  getUtcBudgetWindowStarts,
} from "@/lib/scenes/scene-image-budget";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import type {
  SceneImageDetailsView,
  SceneImageGenerationView,
} from "@/lib/scenes/scene-image-view";
import {
  getSceneImageSizeForAspectRatio,
  sceneImageApiSizeSchema,
} from "@/lib/schemas/scene-image";
import { SCENE_IMAGE_PROMPT_VERSION } from "@studio/prompts";

const referenceTypeLabels = {
  master: "Master identity",
  front: "Front view",
  threeQuarter: "Three-quarter view",
  side: "Side view",
  fullBody: "Full-body view",
  expression: "Expression reference",
  outfit: "Outfit reference",
  pose: "Pose reference",
} as const satisfies Record<CharacterReferenceType, string>;

function formatCreatedAt(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

// Preference order for the single canonical reference chosen per character when
// pre-selecting defaults. Non-identity views (expression/outfit/pose) are never
// auto-selected.
const canonicalReferencePriority: CharacterReferenceType[] = [
  "master",
  "front",
  "threeQuarter",
  "side",
  "fullBody",
];

/**
 * Pick one canonical reference per assigned character (highest-priority view
 * available), capped at `maximum`, so scene image generation is
 * character-consistent by default without manual reference selection.
 */
function selectDefaultReferenceAssetIds(
  rows: {
    character: { id: string; name: string };
    reference: { id: string; type: CharacterReferenceType };
  }[],
  maximum: number,
): string[] {
  const bestByCharacter = new Map<
    string,
    { referenceId: string; name: string; rank: number }
  >();
  for (const { character, reference } of rows) {
    const rank = canonicalReferencePriority.indexOf(reference.type);
    if (rank === -1) continue;
    const existing = bestByCharacter.get(character.id);
    if (!existing || rank < existing.rank)
      bestByCharacter.set(character.id, {
        referenceId: reference.id,
        name: character.name,
        rank,
      });
  }
  return [...bestByCharacter.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, maximum)
    .map((entry) => entry.referenceId);
}

export async function loadSceneImageDetails(input: {
  workspaceId: string;
  project: Project;
  sceneId: string;
  sceneVersionId: string;
  now?: Date;
}): Promise<SceneImageDetailsView | null> {
  const scope = {
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  };
  const currentScene = await findCurrentScene({
    ...scope,
    sceneId: input.sceneId,
  });
  if (!currentScene || currentScene.version.id !== input.sceneVersionId)
    return null;

  const environment = getSceneImageEnvironment();
  const { dailyWindowStart, monthlyWindowStart } = getUtcBudgetWindowStarts(
    input.now ?? new Date(),
  );
  const effectiveBudget = await loadEffectiveWorkspaceBudget({
    workspaceId: scope.workspaceId,
  });
  const [
    initialStylePresetRows,
    referenceRows,
    generationRows,
    projectCommittedCents,
    workspaceDailyCommittedCents,
    workspaceMonthlyCommittedCents,
  ] = await Promise.all([
    listLatestStylePresetVersions({
      workspaceId: input.workspaceId,
      limit: 100,
    }),
    listEligibleSceneReferenceAssets({
      ...scope,
      sceneVersionId: input.sceneVersionId,
      limit: 100,
    }),
    listSceneImageGenerationSummaries({
      ...scope,
      sceneId: input.sceneId,
      sceneVersionId: input.sceneVersionId,
      limit: environment.MAX_IMAGE_GENERATIONS_PER_SCENE_VERSION,
    }),
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
  let stylePresetRows = initialStylePresetRows;
  if (stylePresetRows.length === 0) {
    await ensureDefaultStylePreset(input.workspaceId);
    stylePresetRows = await listLatestStylePresetVersions({
      workspaceId: input.workspaceId,
      limit: 100,
    });
  }
  const generationReferenceRows =
    await listGenerationReferenceAssetsForGenerations({
      ...scope,
      generationIds: generationRows.map(({ generation }) => generation.id),
    });
  const referenceIdsByGeneration = new Map<string, string[]>();
  for (const row of generationReferenceRows) {
    const ids = referenceIdsByGeneration.get(row.generationId) ?? [];
    ids.push(row.reference.referenceAssetIdSnapshot);
    referenceIdsByGeneration.set(row.generationId, ids);
  }

  const generations: SceneImageGenerationView[] = generationRows.map(
    ({ generation, stylePresetVersion, reservationStatus }) => {
      const parsedSize = sceneImageApiSizeSchema.parse(generation.size);
      return {
        id: generation.id,
        generationVersion: generation.generationVersion,
        status: generation.status,
        reviewStatus: generation.reviewStatus,
        model: generation.model,
        quality: generation.quality,
        size: parsedSize,
        outputFormat: generation.outputFormat,
        outputCompression: generation.outputCompression,
        finalPrompt: generation.finalPrompt,
        promptTemplateVersion: generation.promptTemplateVersion,
        stylePresetName: stylePresetVersion.name,
        stylePresetVersion: generation.stylePresetVersion,
        imageUrl:
          generation.status === "succeeded" && generation.assetObjectKey
            ? `/api/projects/${input.project.id}/scene-images/${generation.id}/asset`
            : null,
        estimatedCostCents: generation.estimatedCostCents,
        actualCostCents: generation.actualCostCents,
        progressPercent: generation.progressPercent,
        attemptCount: generation.attemptCount,
        safeErrorMessage: generation.safeErrorMessage,
        reservationReleased: reservationStatus === "released",
        referenceAssetIds: referenceIdsByGeneration.get(generation.id) ?? [],
        createdAtLabel: formatCreatedAt(generation.createdAt),
      };
    },
  );

  return {
    stylePresets: stylePresetRows.map(({ preset, version }) => ({
      id: preset.id,
      versionId: version.id,
      name: version.name,
      description: version.description,
      version: version.version,
      isDefault: preset.isDefault,
      positivePrompt: version.positivePrompt,
      negativePrompt: version.negativePrompt,
      defaultAspectRatio: version.defaultAspectRatio,
    })),
    references: referenceRows.map(({ character, reference }) => ({
      id: reference.id,
      characterId: character.id,
      characterName: character.name,
      typeLabel: referenceTypeLabels[reference.type],
      referenceType: reference.type,
      thumbnailUrl: `/api/workspaces/${input.workspaceId}/characters/${character.id}/references/${reference.id}`,
      width: reference.width,
      height: reference.height,
    })),
    generations,
    configuration: {
      enabled: environment.ENABLE_SCENE_IMAGE_GENERATION,
      model: environment.OPENAI_IMAGE_MODEL,
      outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
      draftQuality: environment.OPENAI_IMAGE_DRAFT_QUALITY,
      finalQuality: environment.OPENAI_IMAGE_FINAL_QUALITY,
      draftCompression: environment.OPENAI_IMAGE_DRAFT_COMPRESSION,
      finalCompression: environment.OPENAI_IMAGE_FINAL_COMPRESSION,
      maximumReferenceAssets: environment.MAX_REFERENCE_ASSETS_PER_GENERATION,
      defaultSize: getSceneImageSizeForAspectRatio(input.project.aspectRatio),
      textInputCostPerMillionCents:
        environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
      referenceInputReserveCents:
        environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
      outputCostMatrix: createSceneImageOutputCostMatrix(environment),
    },
    promptTemplateVersion: SCENE_IMAGE_PROMPT_VERSION,
    defaultReferenceAssetIds: selectDefaultReferenceAssetIds(
      referenceRows.map(({ character, reference }) => ({
        character,
        reference,
      })),
      environment.MAX_REFERENCE_ASSETS_PER_GENERATION,
    ),
    availableBudgetCents: calculateAvailableSceneImageBudgetCents({
      projectLimitCents: input.project.maximumBudgetCents,
      projectCommittedCents,
      workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
      workspaceDailyCommittedCents,
      workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
      workspaceMonthlyCommittedCents,
    }),
  };
}
