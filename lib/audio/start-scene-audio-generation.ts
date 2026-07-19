import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import type { AudioGenerationStatus, Project } from "@/db/schema";
import { createSceneAudioGenerationReservation } from "@/db/commands/scene-audio-commands";
import {
  findVoicePreset,
  getNextSceneAudioGenerationVersion,
  listSceneAudioGenerationsForSceneVersions,
} from "@/db/repositories/scene-audio.repository";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
  listCurrentScenes,
} from "@/db/repositories/scenes.repository";
import { estimateSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  createRequestFingerprint,
  createSceneAudioIdempotencyKey,
} from "@/lib/domain/idempotency";
import { getSceneAudioEnvironment } from "@/lib/env/server";
import {
  buildSceneNarrationInput,
  NarrationInputError,
} from "@/lib/audio/narration-input";
import {
  calculateAvailableSceneImageBudgetCents,
  getUtcBudgetWindowStarts,
} from "@/lib/scenes/scene-image-budget";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { loadEffectiveWorkspaceLimits } from "@/lib/budgets/current-settings";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import type { sceneAudioGenerationTask } from "@/trigger/scene-audio-generation";

export class SceneAudioGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneAudioGenerationRequestError";
  }
}

export interface SceneAudioGenerationResult {
  reservedCount: number;
  requestedCount: number;
  skippedCount: number;
  dispatched: boolean;
  budgetStopped: boolean;
}

type DispatchItem = {
  payload: { generationId: string; workspaceId: string; projectId: string };
  idempotencyKey: string;
};

function isActiveAudioStatus(status: AudioGenerationStatus): boolean {
  return status === "pending" || status === "queued" || status === "running";
}

function deterministicSceneNonce(
  requestNonce: string,
  sceneId: string,
): string {
  const value = createHash("sha256")
    .update(`scene-audio:${requestNonce}:${sceneId}`)
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

export async function startSceneAudioGeneration(input: {
  workspaceId: string;
  requestedByUserId: string;
  project: Project;
  voicePresetId: string;
  sceneIds: string[];
  requestNonce: string;
  now?: Date;
}): Promise<SceneAudioGenerationResult> {
  const environment = getSceneAudioEnvironment();
  if (!environment.ENABLE_SCENE_AUDIO_GENERATION)
    throw new SceneAudioGenerationRequestError(
      "Scene audio generation is disabled.",
    );
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "scene_audio_generation",
    now: input.now,
  });

  const requestedSceneIds = [...new Set(input.sceneIds)];
  if (requestedSceneIds.length === 0)
    throw new SceneAudioGenerationRequestError("Select at least one scene.");
  const limits = await loadEffectiveWorkspaceLimits({
    workspaceId: input.workspaceId,
  });
  if (requestedSceneIds.length > limits.maxScenesPerAudioBatch)
    throw new SceneAudioGenerationRequestError(
      `Generate no more than ${limits.maxScenesPerAudioBatch} scenes at once.`,
    );

  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };
  const [voicePreset, currentScenes] = await Promise.all([
    findVoicePreset({
      workspaceId: input.workspaceId,
      voicePresetId: input.voicePresetId,
    }),
    listCurrentScenes(scope),
  ]);
  if (!voicePreset)
    throw new SceneAudioGenerationRequestError(
      "The selected voice preset is unavailable.",
    );

  const sceneById = new Map(
    currentScenes.map((row) => [row.scene.id, row] as const),
  );
  const generations = await listSceneAudioGenerationsForSceneVersions({
    ...scope,
    sceneVersionIds: currentScenes.map((row) => row.version.id),
  });
  const latestBySceneId = new Map<string, AudioGenerationStatus>();
  for (const generation of generations) {
    const row = sceneById.get(generation.sceneId);
    if (!row || generation.sceneVersionId !== row.version.id) continue;
    if (!latestBySceneId.has(generation.sceneId))
      latestBySceneId.set(generation.sceneId, generation.status);
  }

  const plans: Array<{
    row: (typeof currentScenes)[number];
    text: string;
    characterCount: number;
    estimatedCostCents: number;
  }> = [];
  for (const sceneId of requestedSceneIds) {
    const row = sceneById.get(sceneId);
    if (!row) continue;
    if (row.scene.status !== "approved") continue;
    const latest = latestBySceneId.get(sceneId);
    if (latest && isActiveAudioStatus(latest)) continue;
    let narration;
    try {
      narration = buildSceneNarrationInput({
        narrationText: row.version.narrationText,
        maximumCharacters: environment.MAX_NARRATION_CHARACTERS,
      });
    } catch (error) {
      if (error instanceof NarrationInputError) continue;
      throw error;
    }
    plans.push({
      row,
      text: narration.text,
      characterCount: narration.characterCount,
      estimatedCostCents: estimateSceneAudioCostCents({
        characterCount: narration.characterCount,
        rates: {
          costPerMillionCharactersCents:
            environment.OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS,
          minimumEstimateCents: environment.OPENAI_TTS_MINIMUM_ESTIMATE_CENTS,
        },
      }),
    });
  }
  if (plans.length === 0)
    throw new SceneAudioGenerationRequestError(
      "None of the selected scenes are ready for narration right now.",
    );

  const now = input.now ?? new Date();
  const { dailyWindowStart, monthlyWindowStart } =
    getUtcBudgetWindowStarts(now);
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
  const effectiveBudget = await loadEffectiveWorkspaceBudget({
    workspaceId: input.workspaceId,
  });
  const estimatedTotalCents = plans.reduce(
    (total, plan) => total + plan.estimatedCostCents,
    0,
  );
  const availableBudgetCents = calculateAvailableSceneImageBudgetCents({
    projectLimitCents: input.project.maximumBudgetCents,
    projectCommittedCents,
    workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
    workspaceDailyCommittedCents,
    workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
    workspaceMonthlyCommittedCents,
  });
  if (estimatedTotalCents > availableBudgetCents)
    throw new SceneAudioGenerationRequestError(
      "This narration batch would exceed the available budget.",
    );

  const items: DispatchItem[] = [];
  let budgetStopped = false;
  const voiceFingerprintSuffix = [
    voicePreset.model,
    voicePreset.voice,
    voicePreset.format,
    String(voicePreset.speedScaledPercent),
    voicePreset.instructions,
  ].join("");

  for (const plan of plans) {
    let reserved = false;
    for (let attempt = 0; attempt < 2 && !reserved; attempt++) {
      const generationVersion = await getNextSceneAudioGenerationVersion({
        ...scope,
        sceneVersionId: plan.row.version.id,
      });
      if (
        generationVersion > environment.MAX_AUDIO_GENERATIONS_PER_SCENE_VERSION
      )
        break;
      const generationId = randomUUID();
      const reservationId = randomUUID();
      const requestNonce = deterministicSceneNonce(
        input.requestNonce,
        plan.row.scene.id,
      );
      const idempotencyKey = createSceneAudioIdempotencyKey({
        secret: environment.IDEMPOTENCY_HASH_SECRET,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        sceneVersionId: plan.row.version.id,
        voicePresetId: voicePreset.id,
        generationVersion,
        model: voicePreset.model,
        voice: voicePreset.voice,
        format: voicePreset.format,
        speedScaledPercent: voicePreset.speedScaledPercent,
      });
      const requestFingerprint = createRequestFingerprint(
        environment.REQUEST_FINGERPRINT_SECRET,
        `${plan.text}${voiceFingerprintSuffix}`,
      );
      try {
        const reservation = await createSceneAudioGenerationReservation({
          generationId,
          reservationId,
          workspaceId: input.workspaceId,
          projectId: input.project.id,
          sceneId: plan.row.scene.id,
          sceneVersionId: plan.row.version.id,
          voicePresetId: voicePreset.id,
          generationVersion,
          requestNonce,
          idempotencyKey,
          requestFingerprint,
          provider: voicePreset.provider,
          model: voicePreset.model,
          voice: voicePreset.voice,
          format: voicePreset.format,
          speedScaledPercent: voicePreset.speedScaledPercent,
          instructions: voicePreset.instructions,
          sampleRate: voicePreset.sampleRate,
          inputText: plan.text,
          inputCharacterCount: plan.characterCount,
          estimatedCostCents: plan.estimatedCostCents,
          requestedByUserId: input.requestedByUserId,
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
        });
        items.push({
          payload: {
            generationId: reservation.generation.id,
            workspaceId: input.workspaceId,
            projectId: input.project.id,
          },
          idempotencyKey: reservation.generation.idempotencyKey,
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
          error.message === "SCENE_AUDIO_GENERATION_VERSION_CONFLICT"
        )
          continue;
        throw error;
      }
    }
    if (budgetStopped) break;
  }

  let dispatched = false;
  if (items.length > 0) {
    try {
      await tasks.batchTrigger<typeof sceneAudioGenerationTask>(
        "scene-audio-generation",
        items.map((item) => ({
          payload: item.payload,
          options: { idempotencyKey: item.idempotencyKey },
        })),
      );
      dispatched = true;
    } catch {
      dispatched = false;
    }
  }

  return {
    reservedCount: items.length,
    requestedCount: plans.length,
    skippedCount: requestedSceneIds.length - plans.length,
    dispatched,
    budgetStopped,
  };
}
