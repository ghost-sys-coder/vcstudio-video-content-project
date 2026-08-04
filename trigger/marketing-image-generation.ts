import { task } from "@trigger.dev/sdk";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { appendDeferredToolResultMessage } from "@/db/commands/marketing-chat-commands";
import {
  completeMarketingToolCall,
  failMarketingToolCall,
} from "@/db/commands/marketing-chat-tool-call-commands";
import {
  attachMediaToMarketingContent,
  createMarketingContentItem,
} from "@/db/commands/marketing-content-commands";
import { createGeneratedMediaAsset } from "@/db/commands/media-asset-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
} from "@/db/commands/marketing-usage-commands";
import { findMarketingToolCall } from "@/db/repositories/marketing-chat.repository";
import { findMarketingRun } from "@/db/repositories/marketing-usage.repository";
import type { ContentPlatform } from "@/db/schema";
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
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";
import { putGeneratedMediaAsset } from "@/lib/storage/media-asset-storage";
import { createMediaLibraryObjectKey } from "@/lib/storage/object-key";

const payloadSchema = z.object({ workspaceId: z.uuid(), toolCallId: z.uuid() });

function resolveSize(value: unknown) {
  if (value === "portrait") return "1024x1536" as const;
  if (value === "landscape") return "1536x1024" as const;
  return "1024x1024" as const;
}

export const marketingImageGenerationTask = task({
  id: "marketing-image-generation",
  queue: { name: "image-generation", concurrencyLimit: 2 },
  retry: { maxAttempts: 2, minTimeoutInMs: 2_000, maxTimeoutInMs: 30_000 },
  maxDuration: 300,
  run: async (payload: z.infer<typeof payloadSchema>, { ctx }) => {
    const input = payloadSchema.parse(payload);
    const toolCall = await findMarketingToolCall(input);
    if (!toolCall) throw new Error("Marketing tool call not found.");
    if (["succeeded", "failed", "cancelled"].includes(toolCall.status))
      return { toolCallId: toolCall.id, status: toolCall.status };
    if (!toolCall.runId) throw new Error("Marketing tool call has no run.");
    const ledger = await findMarketingRun({
      workspaceId: input.workspaceId,
      runId: toolCall.runId,
    });
    const hashes = getSceneAnalysisEnvironment();
    if (
      !ledger ||
      ledger.reservation.status !== "pending" ||
      ledger.reservation.expiresAt.getTime() < Date.now() ||
      ledger.reservation.reservedCostCents !== toolCall.estimatedCostCents ||
      ledger.run.requestFingerprint !==
        createRequestFingerprint(
          hashes.REQUEST_FINGERPRINT_SECRET,
          ledger.run.finalPrompt,
        )
    ) {
      await failMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        category: "preflight_failed",
        message: "This image request expired before it could start.",
        actualCostCents: 0,
      });
      return { toolCallId: toolCall.id, status: "failed" as const };
    }
    const environment = getSceneImageEnvironment();
    if (!ledger.run.requestedByUserId)
      throw new Error("Marketing image generation has no requesting user.");
    if (!environment.ENABLE_SCENE_IMAGE_GENERATION)
      throw new Error("Marketing image generation is disabled.");
    await markMarketingRunRunning({
      workspaceId: input.workspaceId,
      runId: ledger.run.id,
      attemptCount: ctx.attempt.number,
    });
    const provider = new OpenAiImageGenerationProvider({
      apiKey: environment.OPENAI_API_KEY,
      timeoutMilliseconds: environment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1_000,
    });
    try {
      const result = await provider.generate({
        model: environment.OPENAI_IMAGE_MODEL,
        prompt: ledger.run.finalPrompt,
        quality: "medium",
        size: resolveSize(toolCall.input.aspectRatio),
        outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
        outputCompression: environment.OPENAI_IMAGE_FINAL_COMPRESSION,
        background: environment.OPENAI_IMAGE_BACKGROUND,
        endUserId: ledger.run.requestedByUserId ?? undefined,
        references: [],
      });
      const actual = result.usage
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
      const cost = reconcileSceneImageCost({
        reservedCostCents: ledger.reservation.reservedCostCents,
        actualCostCents: actual,
      }).chargedCostCents;
      const mediaAssetId = randomUUID();
      const contentType = result.mimeType;
      const objectKey = createMediaLibraryObjectKey({
        workspaceId: input.workspaceId,
        mediaAssetId,
        contentType,
      });
      await putGeneratedMediaAsset({
        objectKey,
        bytes: result.bytes,
        contentType,
      });
      const topic =
        typeof toolCall.input.topic === "string"
          ? toolCall.input.topic
          : "Social graphic";
      await createGeneratedMediaAsset({
        id: mediaAssetId,
        workspaceId: input.workspaceId,
        objectKey,
        contentType,
        sizeBytes: result.bytes.byteLength,
        width: result.width,
        height: result.height,
        title: topic,
        altText: `Generated social graphic for ${topic}`,
        createdByUserId: ledger.run.requestedByUserId,
      });
      const item = await createMarketingContentItem({
        workspaceId: input.workspaceId,
        kind: "graphic",
        platform:
          typeof toolCall.input.platform === "string"
            ? (toolCall.input.platform as ContentPlatform)
            : null,
        title: topic,
        bodyDocument: plainTextToPortableDocument(topic),
        bodyPlainText: topic,
        sourceRunId: ledger.run.id,
        createdByUserId: ledger.run.requestedByUserId,
      });
      await attachMediaToMarketingContent({
        workspaceId: input.workspaceId,
        contentItemId: item.id,
        mediaAssetId,
      });
      const completed = await completeMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        output: { contentItemId: item.id, mediaAssetId },
        actualCostCents: cost,
      });
      await reconcileMarketingUsage({
        workspaceId: input.workspaceId,
        runId: ledger.run.id,
        reservationId: ledger.reservation.id,
        operation: ledger.run.operation,
        actualCostCents: cost,
        providerRequestId: result.requestId,
        safeMetadata: {
          threadId: toolCall.threadId,
          skillKey: toolCall.skillKey,
        },
      });
      if (completed)
        await appendDeferredToolResultMessage({
          workspaceId: input.workspaceId,
          threadId: toolCall.threadId,
          runId: ledger.run.id,
          part: {
            type: "data-toolResult",
            data: {
              skillKey: toolCall.skillKey,
              summary: "Your social graphic is ready for review.",
              contentItemId: item.id,
              mediaAssetId,
            },
          },
          plainText: "Your social graphic is ready for review.",
          costCents: cost,
        });
      return { toolCallId: toolCall.id, status: "succeeded" as const };
    } catch (error) {
      const failure = classifyImageGenerationError(error);
      if (failure.retriable && ctx.attempt.number < (ctx.run.maxAttempts ?? 2))
        throw error;
      const charged = failure.providerMayHaveAcceptedRequest
        ? ledger.reservation.reservedCostCents
        : 0;
      const failed = await failMarketingToolCall({
        workspaceId: input.workspaceId,
        id: toolCall.id,
        category: failure.category,
        message: failure.safeMessage,
        actualCostCents: charged,
      });
      await failMarketingRun({
        workspaceId: input.workspaceId,
        runId: ledger.run.id,
        reservationId: ledger.reservation.id,
        operation: ledger.run.operation,
        category: failure.category,
        message: failure.safeMessage,
        chargedCostCents: charged,
      });
      if (failed)
        await appendDeferredToolResultMessage({
          workspaceId: input.workspaceId,
          threadId: toolCall.threadId,
          runId: ledger.run.id,
          part: {
            type: "data-toolResult",
            data: {
              skillKey: toolCall.skillKey,
              summary: failure.safeMessage,
              failed: true,
            },
          },
          plainText: failure.safeMessage,
          costCents: charged,
        });
      return { toolCallId: toolCall.id, status: "failed" as const };
    }
  },
});
