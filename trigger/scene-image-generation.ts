import { randomUUID } from "node:crypto";
import { task } from "@trigger.dev/sdk";
import {
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_IMAGE_PROMPT_VERSION,
  SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_OUTPAINT_PROMPT_VERSION,
} from "@studio/prompts";
import { z } from "zod";
import {
  completeSceneImageProviderAttempt,
  failSceneImageGeneration,
  failSceneImageProviderAttempt,
  startSceneImageProviderAttempt,
  syncSceneImageGenerationRunning,
} from "@/db/commands/scene-image-commands";
import {
  findPromptTemplateVersion,
  findSceneImageGenerationWorkflowContext,
} from "@/db/repositories/scene-images.repository";
import {
  calculateActualSceneImageCostCents,
  reconcileSceneImageCost,
} from "@/lib/costs/scene-image-cost";
import {
  createRequestFingerprint,
  createSceneImageIdempotencyKey,
} from "@/lib/domain/idempotency";
import { validateSceneImagePreflight } from "@/lib/domain/scene-image-preflight";
import { getSceneImageEnvironment } from "@/lib/env/server";
import {
  classifyImageGenerationError,
  shouldRetryImageGeneration,
} from "@/lib/openai/image-generation-error";
import { ImageGenerationProviderResponseError } from "@/lib/openai/image-generation-provider";
import { getOpenAiReferenceInputFidelitySnapshot } from "@/lib/openai/image-generation-request";
import { OpenAiImageGenerationProvider } from "@/lib/openai/openai-image-generation-provider";
import {
  completeStoredSceneImage,
  failSceneImageWithConservativeProviderOutcome,
  getSceneImageGenerationObjectKey,
  recoverStoredSceneImage,
} from "@/lib/trigger/scene-image-recovery";
import {
  downloadStoredSceneImageReference,
  downloadSceneImageReferences,
  putSceneImage,
} from "@/lib/storage/scene-image-storage";

export const sceneImageGenerationTaskPayloadSchema = z.object({
  generationId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

type SceneImageTaskPayload = z.infer<
  typeof sceneImageGenerationTaskPayloadSchema
>;

function commandUsage(
  usage: {
    inputTextTokens: number;
    inputImageTokens: number;
    outputTokens: number;
  } | null,
) {
  return {
    textInputUnits: usage?.inputTextTokens ?? null,
    imageInputUnits: usage?.inputImageTokens ?? null,
    outputUnits: usage?.outputTokens ?? null,
  };
}

function providerAttemptIdempotencyKey(
  generationIdempotencyKey: string,
  attemptNumber: number,
): string {
  return `${generationIdempotencyKey}:attempt:${attemptNumber}`;
}

function getFailureCost(input: {
  reservedCostCents: number;
  providerMayHaveAcceptedRequest: boolean;
  error: unknown;
  rates: {
    textInputCostPerMillionCents: number;
    imageInputCostPerMillionCents: number;
    outputCostPerMillionCents: number;
  };
}) {
  const usage =
    input.error instanceof ImageGenerationProviderResponseError
      ? input.error.usage
      : null;
  if (usage)
    return {
      usage,
      actualCostCents: calculateActualSceneImageCostCents({
        usage,
        rates: input.rates,
      }),
    };
  return {
    usage: null,
    actualCostCents: input.providerMayHaveAcceptedRequest
      ? input.reservedCostCents
      : 0,
  };
}

export const sceneImageGenerationTask = task({
  id: "scene-image-generation",
  queue: { name: "image-generation", concurrencyLimit: 1 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 600,
  run: async (payload: SceneImageTaskPayload, { ctx }) => {
    const input = sceneImageGenerationTaskPayloadSchema.parse(payload);
    const environment = getSceneImageEnvironment();
    const scope = {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      generationId: input.generationId,
    };
    const context = await findSceneImageGenerationWorkflowContext(scope);
    if (!context) throw new Error("SCENE_IMAGE_GENERATION_NOT_FOUND");
    const { generation, reservation, references, latestProviderRequest } =
      context;

    if (generation.status === "succeeded")
      return { generationId: generation.id, status: "succeeded" as const };
    if (generation.status === "failed" || generation.status === "cancelled")
      return { generationId: generation.id, status: generation.status };

    const recovered = await recoverStoredSceneImage({
      scope,
      generation,
      latestProviderRequest,
    });
    if (recovered)
      return { generationId: generation.id, status: "succeeded" as const };

    if (latestProviderRequest?.status === "succeeded") {
      await failSceneImageWithConservativeProviderOutcome({
        scope,
        providerRequest: latestProviderRequest,
        reservedCostCents:
          reservation?.reservedCostCents ?? generation.estimatedCostCents,
        category: "storage_result_missing",
        safeErrorMessage:
          "The provider completed the image, but its stored result could not be recovered. Generate a new version to try again.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    if (
      latestProviderRequest?.status === "failed" &&
      (latestProviderRequest.actualCostCents ?? 0) > 0
    ) {
      await failSceneImageWithConservativeProviderOutcome({
        scope,
        providerRequest: latestProviderRequest,
        reservedCostCents:
          reservation?.reservedCostCents ?? generation.estimatedCostCents,
        category: "provider_outcome_billed",
        safeErrorMessage:
          "The image provider request incurred usage but did not produce a recoverable result, so it was not repeated. Generate a new version to try again.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    if (
      latestProviderRequest?.status === "running" ||
      latestProviderRequest?.status === "pending"
    ) {
      await failSceneImageWithConservativeProviderOutcome({
        scope,
        providerRequest: latestProviderRequest,
        reservedCostCents:
          reservation?.reservedCostCents ?? generation.estimatedCostCents,
        category: "provider_outcome_ambiguous",
        safeErrorMessage:
          "The image provider outcome could not be confirmed, so the request was not repeated. Generate a new version to try again.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    const isOutpaint = generation.purpose === "variant_outpaint";
    const expectedPromptVersion = isOutpaint
      ? SCENE_OUTPAINT_PROMPT_VERSION
      : SCENE_IMAGE_PROMPT_VERSION;
    const expectedPromptHash = isOutpaint
      ? SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH
      : SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH;
    const promptTemplate = await findPromptTemplateVersion({
      templateKey: isOutpaint ? "scene-outpaint" : "scene-image",
      version: generation.promptTemplateVersion,
    });
    if (
      !promptTemplate ||
      promptTemplate.id !== generation.promptTemplateVersionId ||
      promptTemplate.version !== expectedPromptVersion ||
      promptTemplate.sourceHash !== expectedPromptHash
    ) {
      await failSceneImageGeneration({
        ...scope,
        category: "prompt_template_mismatch",
        safeErrorMessage:
          "The versioned image prompt template could not be verified, so no provider request was made.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    const referenceIds = references.map(
      ({ referenceAssetIdSnapshot }) => referenceAssetIdSnapshot,
    );
    if (generation.sourceImageGenerationId)
      referenceIds.push(generation.sourceImageGenerationId);
    if (generation.outputVariantId)
      referenceIds.push(generation.outputVariantId);
    const expectedInputFidelity = getOpenAiReferenceInputFidelitySnapshot({
      model: generation.model,
      hasReferences: referenceIds.length > 0,
    });
    if (generation.inputFidelity !== expectedInputFidelity) {
      await failSceneImageGeneration({
        ...scope,
        category: "input_fidelity_mismatch",
        safeErrorMessage:
          "The saved reference fidelity configuration could not be verified, so no provider request was made.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }
    const expectedIdempotencyKey = createSceneImageIdempotencyKey({
      secret: environment.IDEMPOTENCY_HASH_SECRET,
      workspaceId: generation.workspaceId,
      projectId: generation.projectId,
      sceneVersionId: generation.sceneVersionId,
      promptTemplateVersion: generation.promptTemplateVersion,
      stylePresetVersion: `${generation.stylePresetVersionId}:${generation.stylePresetVersion}`,
      generationVersion: generation.generationVersion,
      model: generation.model,
      quality: generation.quality,
      size: generation.size,
      outputFormat: generation.outputFormat,
      outputCompression: generation.outputCompression,
      background: generation.background,
      referenceAssetIds: referenceIds,
    });
    const preflight = validateSceneImagePreflight({
      generation,
      reservation,
      references,
      expectedScope: scope,
      expectedFingerprint: createRequestFingerprint(
        environment.REQUEST_FINGERPRINT_SECRET,
        generation.finalPrompt,
      ),
      expectedIdempotencyKey,
      maximumReferenceAssets: environment.MAX_REFERENCE_ASSETS_PER_GENERATION,
      now: new Date(),
    });
    if (!preflight.ok) {
      await failSceneImageGeneration({
        ...scope,
        category: preflight.category,
        safeErrorMessage: preflight.message,
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    if (!environment.ENABLE_SCENE_IMAGE_GENERATION) {
      await failSceneImageGeneration({
        ...scope,
        category: "image_generation_disabled",
        safeErrorMessage: "Scene image generation is currently disabled.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    const maximumAttempts = environment.MAX_IMAGE_GENERATION_RETRIES + 1;
    const attemptNumber = (latestProviderRequest?.attemptNumber ?? 0) + 1;
    if (attemptNumber > maximumAttempts) {
      await failSceneImageGeneration({
        ...scope,
        attemptNumber: latestProviderRequest?.attemptNumber,
        category: "provider_retry_limit_reached",
        safeErrorMessage:
          "The image provider retry limit was reached. Generate a new version to try again.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    await syncSceneImageGenerationRunning(scope);
    const attempt = await startSceneImageProviderAttempt({
      ...scope,
      providerRequestId: randomUUID(),
      provider: "openai",
      model: generation.model,
      idempotencyKey: providerAttemptIdempotencyKey(
        generation.idempotencyKey,
        attemptNumber,
      ),
      attemptNumber,
      estimatedCostCents: generation.estimatedCostCents,
    });
    if (!attempt.created) {
      if (attempt.generation.status === "succeeded")
        return { generationId: generation.id, status: "succeeded" as const };
      throw new Error("SCENE_IMAGE_PROVIDER_ATTEMPT_NOT_CLAIMED");
    }

    let providerReferences;
    try {
      providerReferences = await downloadSceneImageReferences({
        references,
        maximumTotalBytes: environment.MAX_REFERENCE_BYTES_PER_GENERATION,
      });
      if (generation.sourceImageGenerationId) {
        const source = await findSceneImageGenerationWorkflowContext({
          workspaceId: generation.workspaceId,
          projectId: generation.projectId,
          generationId: generation.sourceImageGenerationId,
        });
        if (
          !source?.generation.assetObjectKey ||
          !source.generation.assetContentType ||
          !source.generation.assetEtag ||
          source.generation.status !== "succeeded" ||
          source.generation.reviewStatus !== "approved"
        )
          throw new Error("OUTPAINT_SOURCE_NOT_AVAILABLE");
        providerReferences.push(
          await downloadStoredSceneImageReference({
            generationId: source.generation.id,
            objectKey: source.generation.assetObjectKey,
            contentType: source.generation.assetContentType,
            etag: source.generation.assetEtag,
            maximumBytes: environment.MAX_REFERENCE_BYTES_PER_GENERATION,
          }),
        );
      }
    } catch {
      await failSceneImageProviderAttempt({
        ...scope,
        attemptNumber,
        errorCode: "reference_download_failed",
        safeErrorMessage:
          "One or more selected reference images could not be loaded.",
      });
      await failSceneImageGeneration({
        ...scope,
        attemptNumber,
        category: "reference_download_failed",
        safeErrorMessage:
          "One or more selected reference images could not be loaded.",
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    const provider = new OpenAiImageGenerationProvider({
      apiKey: environment.OPENAI_API_KEY,
      timeoutMilliseconds: environment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1_000,
    });
    let result: Awaited<ReturnType<typeof provider.generate>>;
    try {
      result = await provider.generate({
        model: generation.model,
        prompt: generation.finalPrompt,
        quality: generation.quality,
        size: z
          .enum(["1536x1024", "1024x1536", "1024x1024"])
          .parse(generation.size),
        outputFormat: generation.outputFormat,
        outputCompression: generation.outputCompression,
        background: z.enum(["opaque", "auto"]).parse(generation.background),
        endUserId: generation.requestedByUserId,
        references: providerReferences,
      });
    } catch (error) {
      const failure = classifyImageGenerationError(error);
      const rates = {
        textInputCostPerMillionCents:
          environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
        imageInputCostPerMillionCents:
          environment.OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          environment.OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS,
      };
      const failureCost = getFailureCost({
        reservedCostCents: reservation.reservedCostCents,
        providerMayHaveAcceptedRequest: failure.providerMayHaveAcceptedRequest,
        error,
        rates,
      });
      await failSceneImageProviderAttempt({
        ...scope,
        attemptNumber,
        errorCode: failure.category,
        safeErrorMessage: failure.safeMessage,
        actualCostCents: failureCost.actualCostCents,
        safeMetadata: {
          providerMayHaveAcceptedRequest:
            failure.providerMayHaveAcceptedRequest,
        },
      });

      if (
        shouldRetryImageGeneration({
          failure,
          attemptNumber,
          maximumAttempts,
        }) &&
        ctx.attempt.number < (ctx.run.maxAttempts ?? 3)
      )
        throw error;

      await failSceneImageGeneration({
        ...scope,
        attemptNumber,
        category: failure.category,
        safeErrorMessage: failure.safeMessage,
        providerRequestIdentifier: failure.requestId ?? undefined,
        usage: commandUsage(failureCost.usage),
        actualCostCents: failureCost.actualCostCents,
        errorCode: failure.category,
        safeMetadata: {
          providerMayHaveAcceptedRequest:
            failure.providerMayHaveAcceptedRequest,
        },
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    const actualCostFromUsage = result.usage
      ? calculateActualSceneImageCostCents({
          usage: result.usage,
          rates: {
            textInputCostPerMillionCents:
              environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
            imageInputCostPerMillionCents:
              environment.OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS,
            outputCostPerMillionCents:
              environment.OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS,
          },
        })
      : null;
    const reconciliation = reconcileSceneImageCost({
      reservedCostCents: reservation.reservedCostCents,
      actualCostCents: actualCostFromUsage,
    });
    const usage = commandUsage(result.usage);
    const safeMetadata = {
      ...result.safeMetadata,
      operation: result.operation,
      costBasis: reconciliation.costBasis,
    };

    const completedProviderRequest = await completeSceneImageProviderAttempt({
      ...scope,
      attemptNumber,
      providerRequestIdentifier: result.requestId,
      usage,
      actualCostCents: reconciliation.chargedCostCents,
      safeMetadata,
    });

    let stored;
    try {
      stored = await putSceneImage({
        objectKey: getSceneImageGenerationObjectKey(generation),
        generationId: generation.id,
        result,
        actualCostCents: reconciliation.chargedCostCents,
        costBasis: reconciliation.costBasis,
      });
    } catch {
      const recoveredAfterUploadError = await recoverStoredSceneImage({
        scope,
        generation,
        latestProviderRequest: completedProviderRequest,
      });
      if (recoveredAfterUploadError)
        return { generationId: generation.id, status: "succeeded" as const };

      await failSceneImageGeneration({
        ...scope,
        attemptNumber,
        category: "storage_upload_failed",
        safeErrorMessage:
          "The generated image could not be saved. Generate a new version to try again.",
        providerRequestStatus: "succeeded",
        providerRequestIdentifier: result.requestId ?? undefined,
        usage,
        actualCostCents: reconciliation.chargedCostCents,
        errorCode: "storage_upload_failed",
        safeMetadata,
      });
      return { generationId: generation.id, status: "failed" as const };
    }

    await completeStoredSceneImage({
      scope,
      generation,
      providerRequest: completedProviderRequest,
      stored,
    });
    return { generationId: generation.id, status: "succeeded" as const };
  },
});
