import "server-only";

import type { ContentPlatform, ProductionRun, Project } from "@/db/schema";
import { findChannelProfile } from "@/db/repositories/channel-profiles.repository";
import {
  listLatestSceneAudioForGate,
  listLatestSceneImagesForGate,
} from "@/db/repositories/production-runs.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import { findProjectScriptDraft } from "@/db/repositories/projects.repository";
import { findReleasePackage } from "@/db/repositories/release-packages.repository";
import { findDefaultVoicePreset } from "@/db/repositories/scene-audio.repository";
import {
  findApprovedScriptVersion,
  findSceneAnalysisRun,
  listCurrentScenes,
} from "@/db/repositories/scenes.repository";
import { findScriptGenerationRun } from "@/db/repositories/script-generation.repository";
import {
  findThumbnailGeneration,
  listProjectThumbnails,
} from "@/db/repositories/thumbnail-generation.repository";
import {
  findLatestCompletedTitleGenerationRunForPlatform,
  findTitleGenerationRun,
  listTitleSuggestionsForRuns,
} from "@/db/repositories/title-generation.repository";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import {
  getProjectEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import type { ProductionRunFacts } from "@/lib/production-runs/plan-production-step";
import { parseProductionRunPolicy } from "@/lib/production-runs/production-run-policy";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";

/** Which platform a run packages for: the project's channel, else YouTube. */
export async function resolveRunPlatform(input: {
  workspaceId: string;
  project: Project;
}): Promise<{
  platform: ContentPlatform;
  channelPlatform: ContentPlatform | null;
}> {
  if (!input.project.channelProfileId)
    return { platform: "youtube", channelPlatform: null };
  const channel = await findChannelProfile({
    workspaceId: input.workspaceId,
    channelProfileId: input.project.channelProfileId,
  });
  const channelPlatform = channel?.profile.platform ?? null;
  return { platform: channelPlatform ?? "youtube", channelPlatform };
}

/**
 * Reads everything the planner needs, from the rows the run and the stages
 * own. Every lookup is scoped by workspace and project, and the run's own
 * references decide which generation, analysis and render are "its own".
 */
export async function loadProductionRunFacts(input: {
  workspaceId: string;
  project: Project;
  run: ProductionRun;
}): Promise<ProductionRunFacts> {
  const { workspaceId, project, run } = input;
  const scope = { workspaceId, projectId: project.id };
  const policy = parseProductionRunPolicy(run.policy);
  const references = run.stageReferences;

  const [
    approvedScript,
    draft,
    brief,
    scriptGeneration,
    analysis,
    currentScenes,
    channel,
    defaultVoice,
    ownRender,
  ] = await Promise.all([
    findApprovedScriptVersion(scope),
    findProjectScriptDraft(scope),
    findProjectBrief(scope),
    references.scriptGenerationRunId
      ? findScriptGenerationRun({
          ...scope,
          scriptGenerationRunId: references.scriptGenerationRunId,
        })
      : null,
    references.sceneAnalysisRunId
      ? findSceneAnalysisRun({
          ...scope,
          analysisRunId: references.sceneAnalysisRunId,
        })
      : null,
    listCurrentScenes(scope),
    resolveRunPlatform({ workspaceId, project }),
    policy.voicePresetId ? null : findDefaultVoicePreset({ workspaceId }),
    references.renderId
      ? findVideoRender({ ...scope, renderId: references.renderId })
      : null,
  ]);

  const sceneVersionIds = currentScenes.map(({ version }) => version.id);
  const targetSize = getSceneImageSizeForAspectRatio(project.aspectRatio);
  const [images, audio] = await Promise.all([
    listLatestSceneImagesForGate({
      ...scope,
      sceneVersionIds,
      size: targetSize,
    }),
    listLatestSceneAudioForGate({ ...scope, sceneVersionIds }),
  ]);
  const imageByVersion = new Map(
    images.map((row) => [row.sceneVersionId, row]),
  );
  const audioByVersion = new Map(audio.map((row) => [row.sceneVersionId, row]));

  const platform = channel.platform;
  const [titleRun, latestTitles, thumbnail, thumbnails, releasePackage] =
    await Promise.all([
      references.titleGenerationRunId
        ? findTitleGenerationRun({
            ...scope,
            titleGenerationRunId: references.titleGenerationRunId,
          })
        : null,
      findLatestCompletedTitleGenerationRunForPlatform({ ...scope, platform }),
      references.thumbnailGenerationId
        ? findThumbnailGeneration({
            ...scope,
            thumbnailGenerationId: references.thumbnailGenerationId,
          })
        : null,
      listProjectThumbnails({ ...scope, platform, limit: 20 }),
      references.releasePackageId
        ? findReleasePackage({
            ...scope,
            releasePackageId: references.releasePackageId,
          })
        : null,
    ]);
  const suggestions = latestTitles
    ? await listTitleSuggestionsForRuns({
        ...scope,
        titleGenerationRunIds: [latestTitles.id],
      })
    : [];

  return {
    project: {
      id: project.id,
      status: project.status,
      maximumBudgetCents: project.maximumBudgetCents,
      channelPlatform: channel.channelPlatform,
    },
    script: {
      approvedVersionId: approvedScript?.id ?? null,
      draft: draft
        ? {
            content: draft.content,
            revision: draft.revision,
            updatedAt: draft.updatedAt,
          }
        : null,
      briefHasTopic: (brief?.topic.trim() ?? "") !== "",
      targetDurationSeconds: brief?.targetDurationSeconds ?? null,
      maximumCharacters: getProjectEnvironment().MAX_SCRIPT_CHARACTERS,
      generation: scriptGeneration
        ? {
            id: scriptGeneration.id,
            status: scriptGeneration.status,
            generatedContent: scriptGeneration.generatedContent,
            completedAt: scriptGeneration.completedAt,
            safeErrorMessage: scriptGeneration.safeErrorMessage,
          }
        : null,
    },
    scenes: {
      analysis: analysis
        ? {
            id: analysis.id,
            status: analysis.status,
            safeErrorMessage: analysis.safeErrorMessage,
          }
        : null,
      current: currentScenes.map(({ scene, version }) => ({
        sceneId: scene.id,
        sceneVersionId: version.id,
        sceneNumber: scene.sceneNumber,
        status: scene.status,
        narrationText: version.narrationText,
        visualDescription: version.visualDescription,
      })),
      maximumScenes: getSceneAnalysisEnvironment().MAX_SCENES_PER_PROJECT,
    },
    images: {
      targetSize,
      perScene: currentScenes.map(({ scene, version }) => {
        const latest = imageByVersion.get(version.id) ?? null;
        return {
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          latest: latest
            ? {
                id: latest.id,
                status: latest.status,
                reviewStatus: latest.reviewStatus,
                assetObjectKey: latest.assetObjectKey,
                assetWidth: latest.assetWidth,
                assetHeight: latest.assetHeight,
                safeErrorMessage: latest.safeErrorMessage,
              }
            : null,
        };
      }),
    },
    audio: {
      voicePresetId: policy.voicePresetId ?? defaultVoice?.id ?? null,
      perScene: currentScenes.map(({ scene, version }) => {
        const latest = audioByVersion.get(version.id) ?? null;
        return {
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          narrationText: version.narrationText,
          latest: latest
            ? {
                id: latest.id,
                status: latest.status,
                reviewStatus: latest.reviewStatus,
                assetObjectKey: latest.assetObjectKey,
                durationMilliseconds: latest.durationMilliseconds,
                amplitudeEnvelope: latest.amplitudeEnvelope,
                safeErrorMessage: latest.safeErrorMessage,
              }
            : null,
        };
      }),
    },
    render: {
      own: ownRender
        ? {
            id: ownRender.id,
            status: ownRender.status,
            safeErrorMessage: ownRender.safeErrorMessage,
          }
        : null,
    },
    release: {
      platform,
      titles: titleRun
        ? {
            status: titleRun.status,
            safeErrorMessage: titleRun.safeErrorMessage,
          }
        : null,
      hasTitleSuggestions: suggestions.length > 0,
      thumbnail: thumbnail
        ? {
            status: thumbnail.status,
            safeErrorMessage: thumbnail.safeErrorMessage,
          }
        : null,
      hasUsableThumbnail: thumbnails.some(
        (row) => row.status === "succeeded" && row.assetObjectKey !== null,
      ),
      packageId: releasePackage?.id ?? null,
    },
  };
}
