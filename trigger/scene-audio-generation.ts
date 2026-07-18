import { randomUUID } from "node:crypto";
import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  claimSceneAudioRunning,
  completeSceneAudioGeneration,
  failSceneAudioGeneration,
} from "@/db/commands/scene-audio-commands";
import { findSceneAudioGenerationWorkflowContext } from "@/db/repositories/scene-audio.repository";
import { calculateActualSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";
import { getSceneAudioEnvironment } from "@/lib/env/server";
import {
  probeAudioDurationMilliseconds,
  FfprobeUnavailableError,
} from "@/lib/media/ffprobe";
import {
  classifyAudioGenerationError,
  shouldRetryAudioGeneration,
} from "@/lib/openai/audio-generation-error";
import { OpenAiSceneAudioProvider } from "@/lib/openai/scene-audio-provider";
import {
  findStoredSceneAudio,
  putSceneAudio,
} from "@/lib/storage/scene-audio-storage";

export const sceneAudioGenerationTaskPayloadSchema = z.object({
  generationId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

type SceneAudioTaskPayload = z.infer<
  typeof sceneAudioGenerationTaskPayloadSchema
>;

function getSceneAudioObjectKey(generation: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  id: string;
  format: string;
}): string {
  return `workspaces/${generation.workspaceId}/projects/${generation.projectId}/scenes/${generation.sceneId}/audio/${generation.id}.${generation.format}`;
}

export const sceneAudioGenerationTask = task({
  id: "scene-audio-generation",
  queue: { name: "audio-generation", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async (payload: SceneAudioTaskPayload, { ctx }) => {
    const input = sceneAudioGenerationTaskPayloadSchema.parse(payload);
    const environment = getSceneAudioEnvironment();
    const scope = {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      generationId: input.generationId,
    };
    const context = await findSceneAudioGenerationWorkflowContext(scope);
    if (!context) throw new Error("SCENE_AUDIO_GENERATION_NOT_FOUND");
    const { generation, reservation } = context;

    if (generation.status === "succeeded")
      return { generationId: generation.id, status: "succeeded" as const };
    if (generation.status === "failed" || generation.status === "cancelled")
      return { generationId: generation.id, status: generation.status };

    if (!environment.ENABLE_SCENE_AUDIO_GENERATION) {
      await failSceneAudioGeneration({
        ...scope,
        category: "audio_generation_disabled",
        safeErrorMessage: "Scene audio generation is currently disabled.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }
    if (!reservation || reservation.status !== "pending") {
      await failSceneAudioGeneration({
        ...scope,
        category: "reservation_not_pending",
        safeErrorMessage:
          "The audio reservation was not available. Generate a new version to try again.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    const objectKey = getSceneAudioObjectKey(generation);
    const rates = {
      costPerMillionCharactersCents:
        environment.OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS,
      minimumEstimateCents: environment.OPENAI_TTS_MINIMUM_ESTIMATE_CENTS,
    };
    const actualCostCents = calculateActualSceneAudioCostCents({
      characterCount: generation.inputCharacterCount,
      rates,
    });

    // Recover an already-uploaded asset from a previous crashed attempt.
    const alreadyStored = await findStoredSceneAudio({
      objectKey,
      generationId: generation.id,
    });
    if (alreadyStored) {
      await completeSceneAudioGeneration({
        ...scope,
        providerRequestId: alreadyStored.providerRequestId,
        actualCostCents: alreadyStored.actualCostCents,
        durationMilliseconds: alreadyStored.durationMilliseconds,
        asset: {
          objectKey: alreadyStored.objectKey,
          contentType: alreadyStored.contentType,
          sizeBytes: alreadyStored.sizeBytes,
          etag: alreadyStored.etag,
        },
      });
      return { generationId: generation.id, status: "succeeded" as const };
    }

    const maximumAttempts = environment.MAX_AUDIO_GENERATION_RETRIES + 1;
    const attemptNumber = generation.attemptCount + 1;
    if (attemptNumber > maximumAttempts) {
      await failSceneAudioGeneration({
        ...scope,
        category: "provider_retry_limit_reached",
        safeErrorMessage:
          "The audio provider retry limit was reached. Generate a new version to try again.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    const providerRequestId = randomUUID();
    const claim = await claimSceneAudioRunning({
      ...scope,
      attemptNumber,
      providerRequestId,
    });
    if (!claim.claimed && claim.generation.status === "succeeded")
      return { generationId: generation.id, status: "succeeded" as const };

    const provider = new OpenAiSceneAudioProvider({
      apiKey: environment.OPENAI_API_KEY,
      timeoutMilliseconds: environment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1_000,
    });

    let result: Awaited<ReturnType<typeof provider.generate>>;
    try {
      result = await provider.generate({
        model: generation.model,
        text: generation.inputText,
        voice: generation.voice,
        format: generation.format,
        speedScaledPercent: generation.speedScaledPercent,
        instructions: generation.instructions,
        endUserId: generation.requestedByUserId,
      });
    } catch (error) {
      const failure = classifyAudioGenerationError(error);
      if (
        shouldRetryAudioGeneration({
          failure,
          attemptNumber,
          maximumAttempts,
        }) &&
        ctx.attempt.number < (ctx.run.maxAttempts ?? 3)
      )
        throw error;
      await failSceneAudioGeneration({
        ...scope,
        category: failure.category,
        safeErrorMessage: failure.safeMessage,
        providerBilled: failure.providerMayHaveBilled,
        actualCostCents: failure.providerMayHaveBilled ? actualCostCents : 0,
        providerRequestId,
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    let stored;
    try {
      // Inspect duration first so it can be persisted with the object; a
      // missing ffprobe binary or unreadable audio yields null rather than
      // discarding the paid audio.
      let durationMilliseconds: number | null = null;
      try {
        durationMilliseconds = await probeAudioDurationMilliseconds({
          bytes: result.bytes,
          ffprobePath: environment.FFPROBE_PATH,
          extension: result.format,
        });
      } catch (error) {
        if (!(error instanceof FfprobeUnavailableError)) throw error;
        durationMilliseconds = null;
      }

      stored = await putSceneAudio({
        objectKey,
        generationId: generation.id,
        bytes: result.bytes,
        contentType: result.contentType,
        providerRequestId: result.requestId,
        actualCostCents,
        characterCount: result.characterCount,
        durationMilliseconds,
      });

      await completeSceneAudioGeneration({
        ...scope,
        providerRequestId: result.requestId,
        actualCostCents,
        durationMilliseconds,
        asset: {
          objectKey: stored.objectKey,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          etag: stored.etag,
        },
      });
      return { generationId: generation.id, status: "succeeded" as const };
    } catch {
      // The provider call already incurred cost; record it conservatively.
      await failSceneAudioGeneration({
        ...scope,
        category: "storage_upload_failed",
        safeErrorMessage:
          "The generated narration could not be saved. Generate a new version to try again.",
        providerBilled: true,
        actualCostCents,
        providerRequestId: result.requestId,
      });
      return { generationId: generation.id, status: "failed" as const };
    }
  },
});
