import "server-only";

import type { Project } from "@/db/schema";
import { ensureDefaultStylePreset } from "@/db/commands/ensure-default-style-preset.command";
import {
  findLatestSceneImageBatch,
  getSceneImageBatchAggregate,
} from "@/db/repositories/scene-image-batches.repository";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
  listLatestStylePresetVersions,
  listSceneImageGenerationsForSceneVersions,
} from "@/db/repositories/scene-images.repository";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { deriveSceneImageBatchDisplayStatus } from "@/lib/domain/bulk-scene-image";
import {
  calculateAvailableSceneImageBudgetCents,
  getUtcBudgetWindowStarts,
} from "@/lib/scenes/scene-image-budget";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { loadEffectiveWorkspaceLimits } from "@/lib/budgets/current-settings";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import { classifySceneBulkEligibility } from "@/lib/scenes/scene-image-eligibility";
import type {
  StoryboardBatchView,
  StoryboardSceneImageView,
  StoryboardSceneView,
  StoryboardView,
} from "@/lib/scenes/storyboard-view";
import {
  getSceneImageSizeForAspectRatio,
  type SceneImageApiSize,
} from "@/lib/schemas/scene-image";
import { SCENE_IMAGE_PROMPT_VERSION } from "@studio/prompts";

function formatCreatedAt(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export async function loadStoryboard(input: {
  workspaceId: string;
  project: Project;
  now?: Date;
}): Promise<StoryboardView> {
  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };
  const environment = getSceneImageEnvironment();
  const { dailyWindowStart, monthlyWindowStart } = getUtcBudgetWindowStarts(
    input.now ?? new Date(),
  );
  const effectiveBudget = await loadEffectiveWorkspaceBudget({
    workspaceId: scope.workspaceId,
  });
  const effectiveLimits = await loadEffectiveWorkspaceLimits({
    workspaceId: scope.workspaceId,
  });

  const currentScenes = await listCurrentScenes(scope);
  const [
    generations,
    initialStylePresetRows,
    latestBatch,
    projectCommittedCents,
    workspaceDailyCommittedCents,
    workspaceMonthlyCommittedCents,
  ] = await Promise.all([
    listSceneImageGenerationsForSceneVersions({
      ...scope,
      sceneVersionIds: currentScenes.map((row) => row.version.id),
    }),
    listLatestStylePresetVersions({
      workspaceId: input.workspaceId,
      limit: 100,
    }),
    findLatestSceneImageBatch(scope),
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

  // Latest and approved generation, per scene, PER SIZE — a scene can have an
  // approved image for each size independently. Rows arrive ordered scene
  // asc / generationVersion desc, so the first row seen for a given
  // (sceneId, size) pair is that size's latest.
  const latestByScene = new Map<
    string,
    Map<SceneImageApiSize, (typeof generations)[number]>
  >();
  const approvedByScene = new Map<
    string,
    Map<SceneImageApiSize, (typeof generations)[number]>
  >();
  const sceneVersionById = new Map(
    currentScenes.map((row) => [row.scene.id, row.version.id] as const),
  );
  for (const generation of generations) {
    if (sceneVersionById.get(generation.sceneId) !== generation.sceneVersionId)
      continue;
    const size = generation.size as SceneImageApiSize;
    let latestSizes = latestByScene.get(generation.sceneId);
    if (!latestSizes) {
      latestSizes = new Map();
      latestByScene.set(generation.sceneId, latestSizes);
    }
    if (!latestSizes.has(size)) latestSizes.set(size, generation);

    if (
      generation.status === "succeeded" &&
      generation.reviewStatus === "approved"
    ) {
      let approvedSizes = approvedByScene.get(generation.sceneId);
      if (!approvedSizes) {
        approvedSizes = new Map();
        approvedByScene.set(generation.sceneId, approvedSizes);
      }
      if (!approvedSizes.has(size)) approvedSizes.set(size, generation);
    }
  }

  const assetUrl = (generationId: string) =>
    `/api/projects/${input.project.id}/scene-images/${generationId}/asset`;

  const scenes: StoryboardSceneView[] = currentScenes.map(
    ({ scene, version }) => {
      const latestSizes = latestByScene.get(scene.id);
      const approvedSizes = approvedByScene.get(scene.id);
      const sizes = new Set<SceneImageApiSize>([
        ...(latestSizes?.keys() ?? []),
        ...(approvedSizes?.keys() ?? []),
      ]);
      const images: StoryboardSceneImageView[] = [...sizes].map((size) => {
        const latest = latestSizes?.get(size) ?? null;
        const approved = approvedSizes?.get(size) ?? null;
        return {
          size,
          approvedImageUrl: approved ? assetUrl(approved.id) : null,
          latestImageUrl:
            latest && latest.status === "succeeded" && latest.assetObjectKey
              ? assetUrl(latest.id)
              : null,
          latestGenerationId: latest?.id ?? null,
          latestStatus: latest?.status ?? null,
          latestReviewStatus: latest?.reviewStatus ?? null,
          latestGenerationVersion: latest?.generationVersion ?? null,
          progressPercent: latest?.progressPercent ?? 0,
          estimatedCostCents: latest?.estimatedCostCents ?? null,
          actualCostCents: latest?.actualCostCents ?? null,
          safeErrorMessage: latest?.safeErrorMessage ?? null,
        };
      });
      // Eligibility stays scene-level and size-agnostic: any approved size
      // counts as "has an approved image", and the most recently created
      // generation across all sizes represents "latest" activity for gating.
      const mostRecentLatest = [...(latestSizes?.values() ?? [])].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];
      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        sceneStatus: scene.status,
        sceneVersionId: version.id,
        narrationText: version.narrationText,
        characterNames: version.characterNames,
        durationMilliseconds: version.estimatedDurationMilliseconds,
        eligibility: classifySceneBulkEligibility({
          sceneStatus: scene.status,
          hasApprovedImage: Boolean(approvedSizes && approvedSizes.size > 0),
          latestGenerationStatus: mostRecentLatest?.status ?? null,
        }),
        images,
      };
    },
  );

  let latestBatchView: StoryboardBatchView | null = null;
  if (latestBatch) {
    const aggregate = await getSceneImageBatchAggregate({
      ...scope,
      batchId: latestBatch.id,
    });
    latestBatchView = {
      id: latestBatch.id,
      displayStatus: deriveSceneImageBatchDisplayStatus({
        storedStatus: latestBatch.status,
        counts: aggregate.counts,
      }),
      counts: aggregate.counts,
      estimatedCostCents: aggregate.estimatedCostCents,
      actualCostCents: aggregate.actualCostCents,
      requestedSceneCount: latestBatch.requestedSceneCount,
      reservedSceneCount: latestBatch.reservedSceneCount,
      createdAtLabel: formatCreatedAt(latestBatch.createdAt),
    };
  }

  return {
    scenes,
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
    latestBatch: latestBatchView,
    configuration: {
      enabled: environment.ENABLE_SCENE_IMAGE_GENERATION,
      maximumImagesPerBatch: effectiveLimits.maxImagesPerBatch,
      manualConfirmationThresholdCents:
        effectiveBudget.manualConfirmationThresholdCents,
      draftQuality: environment.OPENAI_IMAGE_DRAFT_QUALITY,
      finalQuality: environment.OPENAI_IMAGE_FINAL_QUALITY,
      defaultSize: getSceneImageSizeForAspectRatio(input.project.aspectRatio),
      outputCostMatrix: createSceneImageOutputCostMatrix(environment),
    },
    availableBudgetCents: calculateAvailableSceneImageBudgetCents({
      projectLimitCents: input.project.maximumBudgetCents,
      projectCommittedCents,
      workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
      workspaceDailyCommittedCents,
      workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
      workspaceMonthlyCommittedCents,
    }),
    promptTemplateVersion: SCENE_IMAGE_PROMPT_VERSION,
  };
}
