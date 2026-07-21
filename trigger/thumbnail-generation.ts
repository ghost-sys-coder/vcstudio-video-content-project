import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  completeThumbnailGeneration,
  failThumbnailGeneration,
  markThumbnailGenerationRunning,
} from "@/db/commands/thumbnail-generation-commands";
import {
  findThumbnailGeneration,
  findThumbnailGenerationReservation,
} from "@/db/repositories/thumbnail-generation.repository";
import {
  calculateActualSceneImageCostCents,
  reconcileSceneImageCost,
} from "@/lib/costs/scene-image-cost";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import {
  getSceneAnalysisEnvironment,
  getSceneImageEnvironment,
} from "@/lib/env/server";
import { classifyImageGenerationError } from "@/lib/openai/image-generation-error";
import { OpenAiImageGenerationProvider } from "@/lib/openai/openai-image-generation-provider";
import { createThumbnailObjectKey } from "@/lib/storage/object-key";
import { putThumbnail } from "@/lib/storage/thumbnail-storage";

export const thumbnailGenerationTaskPayloadSchema = z.object({
  thumbnailGenerationId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

export const thumbnailGenerationTask = task({
  id: "thumbnail-generation",
  queue: { name: "image-generation", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async (
    payload: z.infer<typeof thumbnailGenerationTaskPayloadSchema>,
    { ctx },
  ) => {
    const input = thumbnailGenerationTaskPayloadSchema.parse(payload);
    const generation = await findThumbnailGeneration(input);
    if (!generation) throw new Error("Thumbnail generation not found.");
    if (generation.status === "succeeded" || generation.status === "failed")
      return {
        thumbnailGenerationId: generation.id,
        status: generation.status,
      };
    if (generation.status === "cancelled")
      return {
        thumbnailGenerationId: generation.id,
        status: "cancelled" as const,
      };

    const imageEnvironment = getSceneImageEnvironment();
    const textEnvironment = getSceneAnalysisEnvironment();

    // Preflight: never call a billable provider unless the reservation that paid
    // for this call is still pending, unexpired, and covers the prompt we are
    // actually about to send.
    const reservation = await findThumbnailGenerationReservation(generation.id);
    const expectedFingerprint = createRequestFingerprint(
      textEnvironment.REQUEST_FINGERPRINT_SECRET,
      generation.finalPrompt,
    );
    if (
      !reservation ||
      reservation.status !== "pending" ||
      reservation.expiresAt.getTime() < Date.now() ||
      reservation.reservedCostCents !== generation.estimatedCostCents ||
      generation.requestFingerprint !== expectedFingerprint
    ) {
      await failThumbnailGeneration({
        thumbnailGenerationId: generation.id,
        category: "preflight_failed",
        message:
          "The thumbnail reservation was not available. Start a new generation to try again.",
      });
      return {
        thumbnailGenerationId: generation.id,
        status: "failed" as const,
      };
    }

    if (!imageEnvironment.ENABLE_SCENE_IMAGE_GENERATION) {
      await failThumbnailGeneration({
        thumbnailGenerationId: generation.id,
        category: "image_generation_disabled",
        message: "Image generation is currently disabled.",
      });
      return {
        thumbnailGenerationId: generation.id,
        status: "failed" as const,
      };
    }

    await markThumbnailGenerationRunning({
      thumbnailGenerationId: generation.id,
      attemptCount: ctx.attempt.number,
    });

    const provider = new OpenAiImageGenerationProvider({
      apiKey: imageEnvironment.OPENAI_API_KEY,
      timeoutMilliseconds:
        imageEnvironment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1_000,
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
        references: [],
      });
    } catch (error) {
      const failure = classifyImageGenerationError(error);
      if (
        !failure.retriable ||
        ctx.attempt.number >= (ctx.run.maxAttempts ?? 3)
      ) {
        await failThumbnailGeneration({
          thumbnailGenerationId: generation.id,
          category: failure.category,
          message: failure.safeMessage,
          // The provider may already have billed this call, so keep the
          // reservation charged rather than releasing spend we actually incurred.
          chargedCostCents: failure.providerMayHaveAcceptedRequest
            ? reservation.reservedCostCents
            : 0,
        });
        return {
          thumbnailGenerationId: generation.id,
          status: "failed" as const,
        };
      }
      throw error;
    }

    const actualCostCents = result.usage
      ? calculateActualSceneImageCostCents({
          usage: result.usage,
          rates: {
            textInputCostPerMillionCents:
              imageEnvironment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
            imageInputCostPerMillionCents:
              imageEnvironment.OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS,
            outputCostPerMillionCents:
              imageEnvironment.OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS,
          },
        })
      : null;
    const reconciliation = reconcileSceneImageCost({
      reservedCostCents: reservation.reservedCostCents,
      actualCostCents,
    });

    const objectKey = createThumbnailObjectKey({
      workspaceId: generation.workspaceId,
      projectId: generation.projectId,
      platform: generation.platform,
      thumbnailGenerationId: generation.id,
      outputFormat: generation.outputFormat,
    });
    const stored = await putThumbnail({
      objectKey,
      thumbnailGenerationId: generation.id,
      result,
      actualCostCents: reconciliation.chargedCostCents,
      costBasis: reconciliation.costBasis,
    });

    await completeThumbnailGeneration({
      thumbnailGenerationId: generation.id,
      asset: {
        objectKey: stored.objectKey,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        width: stored.width,
        height: stored.height,
        etag: stored.etag,
      },
      actualCostCents: reconciliation.chargedCostCents,
      providerRequestId: result.requestId,
    });

    return {
      thumbnailGenerationId: generation.id,
      status: "succeeded" as const,
    };
  },
});
