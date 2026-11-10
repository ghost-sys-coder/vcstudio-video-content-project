import { ElevenLabsImageError } from "@/lib/elevenlabs/errors";
import "server-only";
import sharp from "sharp";
import { z } from "zod";
import OpenAI from "openai";
import { mcpGenerationRequestSchema } from "@studio/contracts/mcp-generation";
import { claimMcpStandaloneGeneration } from "@/db/repositories/mcp-generation.repository";
import {
  findMcpOperation,
  updateMcpOperation,
} from "@/db/repositories/mcp.repository";
import { completeMcpGeneratedAsset } from "@/db/commands/mcp-generated-asset";
import { settleMcpGeneration } from "@/db/commands/mcp-generation-commands";
import {
  getSceneImageEnvironment,
  getSceneAudioEnvironment,
  getMediaLibraryEnvironment,
  getSceneMediaUploadEnvironment,
} from "@/lib/env/server";
import { createImageProvider } from "@/lib/elevenlabs/create-image-provider";
import { calculateActualSceneImageCostCents } from "@/lib/costs/scene-image-cost";
import { calculateActualSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";
import { createSpeechProvider } from "@/lib/speech/create-speech-provider";
import { createMediaLibraryObjectKey } from "@/lib/storage/object-key";
import { putGeneratedMediaAsset } from "@/lib/storage/media-asset-storage";
import { downloadSceneImageReferences } from "@/lib/storage/scene-image-storage";
import { inspectMediaFile } from "@/lib/media/inspect-media-file";
import { mediaContentTypeSchema } from "@/lib/schemas/media-asset";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import {
  standaloneGenerationPlanSchema,
  buildStandaloneGenerationPlan,
} from "./standalone-generation-plan";
import { assertMcpGenerationWorkerAccess } from "./generation-service";
import { fingerprint } from "./fingerprint";
import { requireMcp } from "./errors";
import { McpError } from "./errors";
import { classifyImageGenerationError } from "@/lib/openai/image-generation-error";
import { classifyAudioGenerationError } from "@/lib/openai/audio-generation-error";
import { SpeechProviderRequestError } from "@/lib/speech/speech-provider";
import { synthesizeSceneNarration } from "@/lib/audio/synthesize-scene-narration";
import { parseNarrationParts } from "@/lib/audio/narration-directives";
import { joinNarrationSegments } from "@/lib/media/join-narration-segments";
import { AUDIO_CONTENT_TYPE_BY_FORMAT } from "@/lib/openai/scene-audio-provider";

export const mcpGenerationTaskInput = z.object({
  workspaceId: z.uuid(),
  operationId: z.uuid(),
});
export async function runStandaloneMcpGeneration(
  input: z.infer<typeof mcpGenerationTaskInput>,
) {
  const initial = await findMcpOperation(input);
  if (!initial || initial.status === "succeeded" || initial.status === "failed")
    return { status: initial?.status ?? "unavailable" };
  const claimed = await claimMcpStandaloneGeneration(
    input.workspaceId,
    input.operationId,
  );
  if (!claimed) return { status: initial.status };
  let submitted = false;
  let actualCostCents = 0;
  let result: Record<string, unknown> = {
    attemptCount: 1,
    startedAt: new Date().toISOString(),
  };
  try {
    const saved = z
      .object({
        request: mcpGenerationRequestSchema,
        plan: standaloneGenerationPlanSchema,
        planHash: z.string(),
      })
      .parse(claimed.input);
    const request = saved.request;
    requireMcp(
      request.kind === "image" || request.kind === "audio",
      "invalid_input",
      "This worker only accepts library generation requests.",
    );
    const plan = saved.plan;
    await assertMcpGenerationWorkerAccess(input.workspaceId, input.operationId);
    requireMcp(
      fingerprint(
        await buildStandaloneGenerationPlan(input.workspaceId, request),
      ) === saved.planHash,
      "conflict",
      "The generation configuration or references changed before submission.",
    );
    await enforceRateLimit({
      workspaceId: input.workspaceId,
      operation:
        plan.kind === "image"
          ? "scene_image_generation"
          : "scene_audio_generation",
    });
    let output: {
      bytes: Buffer;
      contentType: string;
      requestId: string | null;
    };
    if (plan.kind === "image") {
      const env = getSceneImageEnvironment();
      const provider = createImageProvider(plan.configuration.model, {
        kind: "mcp",
        workspaceId: input.workspaceId,
        generationId: input.operationId,
      });
      const references = await downloadSceneImageReferences({
        references: plan.references.map((r) => ({
          referenceAssetIdSnapshot: r.id,
          objectKeySnapshot: r.objectKey,
          contentTypeSnapshot: r.contentType,
          etagSnapshot: r.etag,
        })),
        maximumTotalBytes: env.MAX_REFERENCE_BYTES_PER_GENERATION,
      });
      for (const ref of references)
        await sharp(ref.bytes, { limitInputPixels: 40_000_000 }).stats();
      await assertMcpGenerationWorkerAccess(
        input.workspaceId,
        input.operationId,
      );
      result = {
        ...result,
        provider: plan.configuration.model.startsWith("elevenlabs/")
          ? "elevenlabs"
          : "openai",
        model: plan.configuration.model,
        promptTemplateVersion: plan.promptTemplateVersion,
        providerSubmitted: true,
      };
      const submission = await updateMcpOperation({
        ...input,
        from: ["running"],
        values: { result },
      });
      requireMcp(
        submission,
        "invalid_state",
        "The generation stopped before provider submission.",
      );
      submitted = true;
      actualCostCents = plan.estimatedCostCents;
      const generated = await provider.generate({
        ...plan.configuration,
        endUserId: claimed.userId,
        references,
      });
      actualCostCents = generated.usage
        ? calculateActualSceneImageCostCents({
            usage: generated.usage,
            rates: plan.rates,
          })
        : plan.estimatedCostCents;
      output = {
        bytes: Buffer.from(generated.bytes),
        contentType: generated.mimeType,
        requestId: generated.requestId,
      };
      result = {
        ...result,
        inputUnits: generated.usage
          ? generated.usage.inputTextTokens + generated.usage.inputImageTokens
          : null,
        outputUnits: generated.usage?.outputTokens ?? null,
        providerRequestId: generated.requestId,
        actualCostCents,
        costBasis: generated.usage ? "provider_usage" : "estimate_fallback",
      };
    } else {
      const provider = createSpeechProvider(plan.provider, plan.model);
      await assertMcpGenerationWorkerAccess(
        input.workspaceId,
        input.operationId,
      );
      result = {
        ...result,
        provider: plan.provider,
        model: plan.model,
        promptTemplateVersion: plan.promptTemplateVersion,
        providerSubmitted: false,
      };
      const env = getSceneAudioEnvironment();
      const requestIds: string[] = [];
      let generatedCostCents = 0;
      const generated = await synthesizeSceneNarration({
        parts: parseNarrationParts(plan.text),
        format: plan.format,
        speak: async (text, format) => {
          await assertMcpGenerationWorkerAccess(
            input.workspaceId,
            input.operationId,
          );
          result = { ...result, providerSubmitted: true };
          const submission = await updateMcpOperation({
            ...input,
            from: ["running"],
            values: { result },
          });
          requireMcp(
            submission,
            "invalid_state",
            "The generation stopped before provider submission.",
          );
          submitted = true;
          actualCostCents = plan.estimatedCostCents;
          const clip = await provider.synthesize({
            text,
            voice: { kind: "built_in", name: plan.voice },
            format,
            speedScaledPercent: plan.speedScaledPercent,
            language: plan.language,
            instructions: plan.instructions,
            endUserId: claimed.userId,
          });
          if (clip.requestId) requestIds.push(clip.requestId);
          generatedCostCents += calculateActualSceneAudioCostCents({
            characterCount: clip.characterCount,
            rates: plan.rates,
          });
          result = {
            ...result,
            providerRequestId: requestIds[0] ?? null,
            providerRequestIds: [...requestIds],
            completedCostCents: generatedCostCents,
          };
          await updateMcpOperation({
            ...input,
            from: ["running"],
            values: { result },
          });
          return clip;
        },
        join: (parts, format) =>
          joinNarrationSegments({ parts, format, ffmpegPath: env.FFMPEG_PATH }),
        contentTypeFor: (format) => AUDIO_CONTENT_TYPE_BY_FORMAT[format],
      });
      actualCostCents = generatedCostCents;
      output = generated;
      result = {
        ...result,
        inputUnits: generated.characterCount,
        outputUnits: null,
        providerRequestId: generated.requestId,
        providerRequestIds: requestIds,
        actualCostCents,
        costBasis:
          plan.provider === "elevenlabs"
            ? "conservative_credit_valuation"
            : "character_rate",
      };
    }
    await updateMcpOperation({
      ...input,
      from: ["running"],
      values: { result },
    });
    const contentType = mediaContentTypeSchema.parse(output.contentType);
    const limits = getMediaLibraryEnvironment();
    let width: number | null = null,
      height: number | null = null,
      durationMilliseconds: number | null = null;
    let inspection: Awaited<ReturnType<typeof inspectMediaFile>> | null = null;
    if (plan.kind === "image") {
      requireMcp(
        output.bytes.length <= limits.MAX_MEDIA_IMAGE_BYTES,
        "invalid_media",
        "The generated image exceeds the library size limit.",
      );
      const metadata = await sharp(output.bytes, {
        limitInputPixels: 40_000_000,
      }).metadata();
      // Force full decoding, rather than trusting a header or provider dimensions.
      await sharp(output.bytes, { limitInputPixels: 40_000_000 }).stats();
      width = metadata.width ?? null;
      height = metadata.height ?? null;
      requireMcp(
        width && height && contentType.startsWith("image/"),
        "invalid_media",
        "The generated image could not be verified.",
      );
    } else {
      requireMcp(
        output.bytes.length <=
          getSceneMediaUploadEnvironment().MAX_SCENE_AUDIO_UPLOAD_SIZE_BYTES,
        "invalid_media",
        "The generated audio exceeds the library size limit.",
      );
      const env = getSceneAudioEnvironment();
      inspection = await inspectMediaFile({
        bytes: output.bytes,
        extension: plan.format,
        expectedKind: "audio",
        ffmpegPath: env.FFMPEG_PATH,
        ffprobePath: env.FFPROBE_PATH,
      });
      durationMilliseconds = inspection.metadata.durationMilliseconds;
    }
    const objectKey = createMediaLibraryObjectKey({
      workspaceId: input.workspaceId,
      mediaAssetId: input.operationId,
      contentType,
    });
    await putGeneratedMediaAsset({
      objectKey,
      bytes: output.bytes,
      contentType,
    });
    await completeMcpGeneratedAsset({
      ...input,
      userId: claimed.userId,
      kind: plan.kind,
      objectKey,
      contentType,
      sizeBytes: output.bytes.length,
      title: request.title || `Generated ${plan.kind}`,
      width,
      height,
      durationMilliseconds,
      verifiedMetadata: inspection?.metadata ?? null,
      warnings: inspection?.warnings ?? [],
      result,
    });
    await settleMcpGeneration(
      input.workspaceId,
      input.operationId,
      actualCostCents,
    );
    await recordAuditEvent({
      workspaceId: input.workspaceId,
      actorUserId: claimed.userId,
      action: "mcp_action_completed",
      targetType: "mcp_operation",
      targetId: input.operationId,
      metadata: {
        kind: "media_generated",
        mediaKind: plan.kind,
        actualCostCents,
      },
    });
    return { status: "succeeded", mediaAssetId: input.operationId };
  } catch (error) {
    const imageFailure = classifyImageGenerationError(error);
    const failure =
      ["openai", "elevenlabs"].includes(String(result.provider)) &&
      String(result.model).includes("image")
        ? imageFailure
        : classifyAudioGenerationError(error);
    // A definite client-side refusal is not a billable unknown outcome.
    if (
      submitted &&
      ((error instanceof OpenAI.APIError &&
        !!error.status &&
        error.status >= 400 &&
        error.status < 500) ||
        (error instanceof SpeechProviderRequestError &&
          !!error.status &&
          error.status >= 400 &&
          error.status < 500))
    )
      actualCostCents = 0;
    if (error instanceof ElevenLabsImageError && error.definitelyUnbilled)
      actualCostCents = 0;
    const safeMessage =
      error instanceof McpError ? error.message : failure.safeMessage;
    result = {
      ...result,
      errorCode: error instanceof McpError ? error.code : failure.category,
      providerRequestId:
        result.providerRequestId ??
        (error instanceof SpeechProviderRequestError
          ? error.requestId
          : imageFailure.requestId),
    };
    await settleMcpGeneration(
      input.workspaceId,
      input.operationId,
      submitted ? actualCostCents : 0,
    );
    await updateMcpOperation({
      ...input,
      from: ["running"],
      values: {
        status: "failed",
        error: `${safeMessage} ${submitted && actualCostCents > 0 ? "The recorded or estimated cost was retained. No automatic paid retry was made; inspect the usage ledger before preparing a new request." : "No cost was retained for this failed attempt. Check the request and prepare a fresh generation."}`,
        result: {
          ...result,
          actualCostCents: submitted ? actualCostCents : 0,
          completedAt: new Date().toISOString(),
        },
      },
    });
    await recordAuditEvent({
      workspaceId: input.workspaceId,
      actorUserId: claimed.userId,
      action: "mcp_action_failed",
      targetType: "mcp_operation",
      targetId: input.operationId,
      metadata: {
        kind: "media_generation_failed",
        providerSubmitted: submitted,
      },
    });
    return { status: "failed" };
  }
}
