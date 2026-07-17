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
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import { classifySceneBulkEligibility } from "@/lib/scenes/scene-image-eligibility";
import type {
  StoryboardBatchView,
  StoryboardSceneView,
  StoryboardView,
} from "@/lib/scenes/storyboard-view";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";
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

  const latestByScene = new Map<string, (typeof generations)[number]>();
  const approvedByScene = new Map<string, (typeof generations)[number]>();
  const sceneVersionById = new Map(
    currentScenes.map((row) => [row.scene.id, row.version.id] as const),
  );
  for (const generation of generations) {
    if (sceneVersionById.get(generation.sceneId) !== generation.sceneVersionId)
      continue;
    if (!latestByScene.has(generation.sceneId))
      latestByScene.set(generation.sceneId, generation);
    if (
      generation.status === "succeeded" &&
      generation.reviewStatus === "approved" &&
      !approvedByScene.has(generation.sceneId)
    )
      approvedByScene.set(generation.sceneId, generation);
  }

  const assetUrl = (generationId: string) =>
    `/api/projects/${input.project.id}/scene-images/${generationId}/asset`;

  const scenes: StoryboardSceneView[] = currentScenes.map(
    ({ scene, version }) => {
      const latest = latestByScene.get(scene.id) ?? null;
      const approved = approvedByScene.get(scene.id) ?? null;
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
          hasApprovedImage: approved !== null,
          latestGenerationStatus: latest?.status ?? null,
        }),
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
      maximumImagesPerBatch: environment.MAX_IMAGES_PER_BATCH,
      draftQuality: environment.OPENAI_IMAGE_DRAFT_QUALITY,
      finalQuality: environment.OPENAI_IMAGE_FINAL_QUALITY,
      defaultSize: getSceneImageSizeForAspectRatio(input.project.aspectRatio),
      outputCostMatrix: createSceneImageOutputCostMatrix(environment),
    },
    availableBudgetCents: calculateAvailableSceneImageBudgetCents({
      projectLimitCents: input.project.maximumBudgetCents,
      projectCommittedCents,
      workspaceDailyLimitCents: environment.DEFAULT_DAILY_BUDGET_CENTS,
      workspaceDailyCommittedCents,
      workspaceMonthlyLimitCents: environment.DEFAULT_MONTHLY_BUDGET_CENTS,
      workspaceMonthlyCommittedCents,
    }),
    promptTemplateVersion: SCENE_IMAGE_PROMPT_VERSION,
  };
}
