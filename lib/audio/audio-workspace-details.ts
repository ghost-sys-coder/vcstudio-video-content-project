import "server-only";

import type { Project, SceneAudioGeneration } from "@/db/schema";
import { ensureDefaultVoicePreset } from "@/db/commands/voice-preset-commands";
import {
  listSceneAudioGenerationsForSceneVersions,
  listVoicePresets,
} from "@/db/repositories/scene-audio.repository";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
  listCurrentScenes,
} from "@/db/repositories/scenes.repository";
import { getSceneAudioEnvironment } from "@/lib/env/server";
import {
  calculateAvailableSceneImageBudgetCents,
  getUtcBudgetWindowStarts,
} from "@/lib/scenes/scene-image-budget";
import { buildProjectTimeline } from "@/lib/timeline/scene-timeline";
import type {
  AudioProgressCounts,
  AudioSceneView,
  AudioTimelineSceneView,
  AudioWorkspaceView,
  SceneAudioEligibility,
} from "@/lib/audio/audio-view";

const EMPTY_PROGRESS: AudioProgressCounts = {
  total: 0,
  pending: 0,
  queued: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
};

function normalizeNarration(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function loadAudioWorkspace(input: {
  workspaceId: string;
  project: Project;
  now?: Date;
}): Promise<AudioWorkspaceView> {
  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };
  const environment = getSceneAudioEnvironment();
  const { dailyWindowStart, monthlyWindowStart } = getUtcBudgetWindowStarts(
    input.now ?? new Date(),
  );

  const currentScenes = await listCurrentScenes(scope);
  const [
    generations,
    initialVoicePresets,
    projectCommittedCents,
    workspaceDailyCommittedCents,
    workspaceMonthlyCommittedCents,
  ] = await Promise.all([
    listSceneAudioGenerationsForSceneVersions({
      ...scope,
      sceneVersionIds: currentScenes.map((row) => row.version.id),
    }),
    listVoicePresets({ workspaceId: input.workspaceId }),
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

  let voicePresets = initialVoicePresets;
  if (voicePresets.length === 0) {
    await ensureDefaultVoicePreset({
      workspaceId: input.workspaceId,
      model: environment.OPENAI_TTS_MODEL,
      voice: environment.OPENAI_TTS_VOICE,
      format: environment.OPENAI_TTS_FORMAT,
      speedScaledPercent: environment.OPENAI_TTS_SPEED_SCALED_PERCENT,
    });
    voicePresets = await listVoicePresets({ workspaceId: input.workspaceId });
  }

  const sceneVersionById = new Map(
    currentScenes.map((row) => [row.scene.id, row.version.id] as const),
  );
  const latestByScene = new Map<string, SceneAudioGeneration>();
  const approvedByScene = new Map<string, SceneAudioGeneration>();
  const progress = { ...EMPTY_PROGRESS };
  for (const generation of generations) {
    if (sceneVersionById.get(generation.sceneId) !== generation.sceneVersionId)
      continue;
    if (!latestByScene.has(generation.sceneId)) {
      latestByScene.set(generation.sceneId, generation);
      progress.total += 1;
      progress[generation.status] += 1;
    }
    if (
      generation.status === "succeeded" &&
      generation.reviewStatus === "approved" &&
      !approvedByScene.has(generation.sceneId)
    )
      approvedByScene.set(generation.sceneId, generation);
  }

  const assetUrl = (generationId: string) =>
    `/api/projects/${input.project.id}/scene-audio/${generationId}/asset`;

  const scenes: AudioSceneView[] = currentScenes.map(({ scene, version }) => {
    const latest = latestByScene.get(scene.id) ?? null;
    const approved = approvedByScene.get(scene.id) ?? null;
    const narration = normalizeNarration(version.narrationText);
    const active =
      latest !== null &&
      (latest.status === "pending" ||
        latest.status === "queued" ||
        latest.status === "running");

    let eligibility: SceneAudioEligibility;
    if (scene.status !== "approved") eligibility = "notApproved";
    else if (narration.length === 0) eligibility = "noNarration";
    else if (active) eligibility = "inProgress";
    else if (approved) eligibility = "hasApprovedAudio";
    else eligibility = "eligible";

    return {
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      sceneStatus: scene.status,
      sceneVersionId: version.id,
      narrationPreview:
        narration.length > 240 ? `${narration.slice(0, 240)}…` : narration,
      characterCount: narration.length,
      eligibility,
      latestGenerationId: latest?.id ?? null,
      latestStatus: latest?.status ?? null,
      latestReviewStatus: latest?.reviewStatus ?? null,
      latestGenerationVersion: latest?.generationVersion ?? null,
      progressPercent: latest?.progressPercent ?? 0,
      audioUrl: approved
        ? assetUrl(approved.id)
        : latest && latest.status === "succeeded" && latest.assetObjectKey
          ? assetUrl(latest.id)
          : null,
      approvedAudioUrl: approved ? assetUrl(approved.id) : null,
      durationMilliseconds:
        approved?.durationMilliseconds ??
        (latest?.status === "succeeded"
          ? (latest.durationMilliseconds ?? null)
          : null),
      estimatedCostCents: latest?.estimatedCostCents ?? null,
      actualCostCents: latest?.actualCostCents ?? null,
      safeErrorMessage: latest?.safeErrorMessage ?? null,
    };
  });

  const timelineResult = buildProjectTimeline({
    framesPerSecond: input.project.framesPerSecond,
    paddingMilliseconds: environment.AUDIO_SCENE_PADDING_MILLISECONDS,
    scenes: currentScenes.map(({ scene }) => ({
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      durationMilliseconds:
        approvedByScene.get(scene.id)?.durationMilliseconds ?? 0,
    })),
  });
  const timelineScenes: AudioTimelineSceneView[] = timelineResult.scenes.map(
    (scene) => ({
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      startMilliseconds: scene.startMilliseconds,
      endMilliseconds: scene.endMilliseconds,
      startFrame: scene.startFrame,
      endFrame: scene.endFrame,
      durationMilliseconds: scene.durationMilliseconds,
      hasApprovedAudio: approvedByScene.has(scene.sceneId),
    }),
  );

  return {
    scenes,
    voicePresets: voicePresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      voice: preset.voice,
      model: preset.model,
      instructions: preset.instructions,
      speedScaledPercent: preset.speedScaledPercent,
      format: preset.format,
      isDefault: preset.isDefault,
    })),
    timeline: {
      scenes: timelineScenes,
      framesPerSecond: timelineResult.framesPerSecond,
      paddingMilliseconds: timelineResult.paddingMilliseconds,
      totalDurationMilliseconds: timelineResult.totalDurationMilliseconds,
      totalFrames: timelineResult.totalFrames,
      scenesWithApprovedAudio: approvedByScene.size,
      totalScenes: currentScenes.length,
    },
    configuration: {
      enabled: environment.ENABLE_SCENE_AUDIO_GENERATION,
      maximumScenesPerBatch: environment.MAX_SCENES_PER_AUDIO_BATCH,
      costPerMillionCharactersCents:
        environment.OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS,
      minimumEstimateCents: environment.OPENAI_TTS_MINIMUM_ESTIMATE_CENTS,
      defaultFormat: environment.OPENAI_TTS_FORMAT,
    },
    availableBudgetCents: calculateAvailableSceneImageBudgetCents({
      projectLimitCents: input.project.maximumBudgetCents,
      projectCommittedCents,
      workspaceDailyLimitCents: environment.DEFAULT_DAILY_BUDGET_CENTS,
      workspaceDailyCommittedCents,
      workspaceMonthlyLimitCents: environment.DEFAULT_MONTHLY_BUDGET_CENTS,
      workspaceMonthlyCommittedCents,
    }),
    progress,
  };
}
