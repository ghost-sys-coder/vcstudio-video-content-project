import { speechCostRates } from "@/lib/speech/speech-cost-rates";
import { randomUUID } from "node:crypto";
import { assertMcpGenerationWorkerAccess } from "@/lib/mcp/generation-service";
import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  claimSceneAudioRunning,
  completeSceneAudioGeneration,
  failSceneAudioGeneration,
} from "@/db/commands/scene-audio-commands";
import { findSceneAudioGenerationWorkflowContext } from "@/db/repositories/scene-audio.repository";
import { calculateActualSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";
import { assertAiGeneratedSceneAudio } from "@/lib/domain/scene-audio";
import { getSceneAudioEnvironment } from "@/lib/env/server";
import { computeAudioAmplitudeEnvelope } from "@/lib/media/audio-amplitude";
import {
  probeAudioDurationMilliseconds,
  FfprobeUnavailableError,
} from "@/lib/media/ffprobe";
import {
  classifyAudioGenerationError,
  shouldRetryAudioGeneration,
} from "@/lib/openai/audio-generation-error";
import {
  AUDIO_CONTENT_TYPE_BY_FORMAT,
  OpenAiSceneAudioProvider,
} from "@/lib/openai/scene-audio-provider";
import {
  findStoredSceneAudio,
  putSceneAudio,
} from "@/lib/storage/scene-audio-storage";
import { createSceneAudioObjectKey } from "@/lib/storage/object-key";
import { createSpeechProvider } from "@/lib/speech/create-speech-provider";
import { parseNarrationParts } from "@/lib/audio/narration-directives";
import {
  NarrationSegmentFailure,
  synthesizeSceneNarration,
  type SpokenClip,
} from "@/lib/audio/synthesize-scene-narration";
import {
  joinNarrationSegments,
  NarrationJoinError,
} from "@/lib/media/join-narration-segments";
import type { SceneAudioFormat } from "@/lib/schemas/scene-audio";

export const sceneAudioGenerationTaskPayloadSchema = z.object({
  generationId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

type SceneAudioTaskPayload = z.infer<
  typeof sceneAudioGenerationTaskPayloadSchema
>;

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
    assertAiGeneratedSceneAudio(generation);

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

    const objectKey = createSceneAudioObjectKey({
      workspaceId: generation.workspaceId,
      projectId: generation.projectId,
      sceneId: generation.sceneId,
      generationId: generation.id,
      format: generation.format,
    });
    const rates = speechCostRates(generation.provider ?? "openai");
    let actualCostCents = calculateActualSceneAudioCostCents({
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

    if (generation.mcpOperationId) {
      try {
        await assertMcpGenerationWorkerAccess(
          input.workspaceId,
          generation.mcpOperationId,
        );
      } catch {
        await failSceneAudioGeneration({
          ...scope,
          category: "mcp_authorization_changed",
          safeErrorMessage:
            "The AI connection or scene authorization changed before generation.",
        });
        return { generationId: generation.id, status: "failed" as const };
      }
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
    // A lost speech response has no safe provider polling API. A duplicate run
    // may inspect the original attempt, but must never speak it a second time.
    if (!claim.claimed && generation.provider === "elevenlabs") {
      if (ctx.attempt.number > 1 && claim.generation.status === "running") {
        await failSceneAudioGeneration({
          ...scope,
          category: "provider_outcome_uncertain",
          safeErrorMessage:
            "The previous ElevenLabs speech attempt did not finish. Its estimated cost was retained; no second paid request was made.",
          providerBilled: true,
          actualCostCents: generation.estimatedCostCents,
        });
        return { generationId: generation.id, status: "failed" as const };
      }
      return { generationId: generation.id, status: claim.generation.status };
    }

    let elevenLabsCostCents = 0;
    let result: {
      bytes: Buffer;
      contentType: string;
      format: typeof generation.format;
      requestId: string | null;
      characterCount: number;
    };
    try {
      // The provider is the one recorded on the generation, which came from the
      // voice preset: a voice cloned at Google can only be spoken by Google,
      // whatever the deployment is configured to narrate new voices with.
      const speak = async (
        text: string,
        format: SceneAudioFormat,
      ): Promise<SpokenClip> => {
        if (generation.mcpOperationId)
          await assertMcpGenerationWorkerAccess(
            input.workspaceId,
            generation.mcpOperationId,
          );
        if (
          generation.provider === "gemini" ||
          generation.provider === "elevenlabs"
        ) {
          const synthesized = await createSpeechProvider(
            generation.provider,
            generation.model,
          ).synthesize({
            text,
            voice: generation.isCustomVoice
              ? { kind: "enrolled", providerVoiceId: generation.voice }
              : { kind: "built_in", name: generation.voice },
            format,
            speedScaledPercent: generation.speedScaledPercent,
            language: "en-US",
            instructions: generation.instructions,
            endUserId: generation.requestedByUserId,
          });
          if (generation.provider === "elevenlabs")
            elevenLabsCostCents += calculateActualSceneAudioCostCents({
              characterCount: synthesized.characterCount,
              rates,
            });
          return {
            ...synthesized,
            requestId: synthesized.requestId ?? providerRequestId,
          };
        }
        return new OpenAiSceneAudioProvider({
          apiKey: environment.OPENAI_API_KEY,
          timeoutMilliseconds:
            environment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1_000,
        }).generate({
          model: generation.model,
          text,
          voice: generation.isCustomVoice
            ? { kind: "custom", id: generation.voice }
            : { kind: "built_in", name: generation.voice },
          format,
          speedScaledPercent: generation.speedScaledPercent,
          instructions: generation.instructions,
          endUserId: generation.requestedByUserId,
        });
      };
      // Pause markers in the narration become exact silences: each spoken
      // part is voiced separately and the parts are joined around them.
      result = await synthesizeSceneNarration({
        parts: parseNarrationParts(generation.inputText),
        format: generation.format,
        speak,
        join: (parts, format) =>
          joinNarrationSegments({
            parts,
            format,
            ffmpegPath: environment.FFMPEG_PATH,
          }),
        contentTypeFor: (format) => AUDIO_CONTENT_TYPE_BY_FORMAT[format],
      });
    } catch (error) {
      // A join failure happens after every part was voiced and paid for; a
      // segment failure after earlier parts were. Neither may be reported as
      // free, and a failed join is not worth paying to repeat.
      const failure =
        error instanceof NarrationJoinError
          ? {
              category: "narration_join_failed",
              safeMessage: error.message,
              retriable: false,
              providerMayHaveBilled: true,
            }
          : error instanceof NarrationSegmentFailure
            ? {
                ...classifyAudioGenerationError(error.cause),
                providerMayHaveBilled: true,
              }
            : classifyAudioGenerationError(error);
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

    if (generation.provider === "elevenlabs")
      actualCostCents = elevenLabsCostCents;
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

      // Measured here, while the decoded bytes are already in hand, because the
      // browser preview cannot run ffmpeg and the render worker would otherwise
      // repeat this decode on every attempt. Already null-safe internally.
      const amplitudeEnvelope = await computeAudioAmplitudeEnvelope({
        bytes: result.bytes,
        extension: result.format,
        ffmpegPath: environment.FFMPEG_PATH,
      });

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
        amplitudeEnvelope,
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
