import "server-only";
import { randomUUID } from "node:crypto";
import { attachMediaToMarketingContent } from "@/db/commands/marketing-content-commands";
import { createGeneratedMediaAsset } from "@/db/commands/media-asset-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
} from "@/db/commands/marketing-usage-commands";
import type { ContentPlatform } from "@/db/schema";
import {
  calculateActualSceneImageCostCents,
  estimateSceneImageCost,
  reconcileSceneImageCost,
} from "@/lib/costs/scene-image-cost";
import {
  createMarketingOperationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import {
  getSceneAnalysisEnvironment,
  getSceneImageEnvironment,
} from "@/lib/env/server";
import { OpenAiImageGenerationProvider } from "@/lib/openai/openai-image-generation-provider";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";
import { putGeneratedMediaAsset } from "@/lib/storage/media-asset-storage";
import { createMediaLibraryObjectKey } from "@/lib/storage/object-key";

function sizeForPlatform(platform: ContentPlatform) {
  if (["tiktok", "instagram"].includes(platform)) return "1024x1536" as const;
  if (platform === "youtube") return "1536x1024" as const;
  return "1024x1024" as const;
}

export function estimateMarketingGraphicCostCents(input: {
  platform: ContentPlatform;
  prompt: string;
}) {
  const environment = getSceneImageEnvironment();
  return estimateSceneImageCost({
    prompt: input.prompt,
    quality: "medium",
    size: sizeForPlatform(input.platform),
    referenceAssetCount: 0,
    outputCostMatrix: createSceneImageOutputCostMatrix(environment),
    textInputCostPerMillionCents:
      environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
    referenceInputReserveCents:
      environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
    safetyMarginBasisPoints: 0,
  }).estimatedCostCents;
}

export async function generateCampaignGraphic(input: {
  workspaceId: string;
  campaignId: string | null;
  contentItemId: string;
  platform: ContentPlatform;
  title: string;
  prompt: string;
  requestedByUserId: string;
  usageSubject?: { kind: string; id: string };
}) {
  const environment = getSceneImageEnvironment();
  if (!environment.ENABLE_SCENE_IMAGE_GENERATION)
    throw new Error("Campaign image generation is disabled.");
  const size = sizeForPlatform(input.platform);
  const estimatedCostCents = estimateMarketingGraphicCostCents(input);
  const hashes = getSceneAnalysisEnvironment();
  const reservation = await reserveMarketingUsage({
    workspaceId: input.workspaceId,
    operation: "image_generation",
    estimatedCostCents,
    idempotencyKey: createMarketingOperationIdempotencyKey({
      secret: hashes.IDEMPOTENCY_HASH_SECRET,
      workspaceId: input.workspaceId,
      operation: "image_generation",
      subjectId: input.contentItemId,
      subjectFingerprint: createRequestFingerprint(
        hashes.REQUEST_FINGERPRINT_SECRET,
        input.prompt,
      ),
      model: environment.OPENAI_IMAGE_MODEL,
      promptVersion: "campaign-graphic-v1",
    }),
    requestedByUserId: input.requestedByUserId,
    model: environment.OPENAI_IMAGE_MODEL,
    promptVersion: "campaign-graphic-v1",
    finalPrompt: input.prompt,
    requestFingerprint: createRequestFingerprint(
      hashes.REQUEST_FINGERPRINT_SECRET,
      input.prompt,
    ),
    subjectKind: input.usageSubject?.kind ?? "campaign_content_item",
    subjectId: input.usageSubject?.id ?? input.contentItemId,
  });
  await markMarketingRunRunning({
    workspaceId: input.workspaceId,
    runId: reservation.runId,
    attemptCount: 1,
  });
  const provider = new OpenAiImageGenerationProvider({
    apiKey: environment.OPENAI_API_KEY,
    timeoutMilliseconds: environment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1_000,
  });
  try {
    const result = await provider.generate({
      model: environment.OPENAI_IMAGE_MODEL,
      prompt: input.prompt,
      quality: "medium",
      size,
      outputFormat: environment.OPENAI_IMAGE_OUTPUT_FORMAT,
      outputCompression: environment.OPENAI_IMAGE_FINAL_COMPRESSION,
      background: environment.OPENAI_IMAGE_BACKGROUND,
      endUserId: input.requestedByUserId,
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
      reservedCostCents: estimatedCostCents,
      actualCostCents: actual,
    }).chargedCostCents;
    const mediaAssetId = randomUUID();
    const objectKey = createMediaLibraryObjectKey({
      workspaceId: input.workspaceId,
      mediaAssetId,
      contentType: result.mimeType,
    });
    await putGeneratedMediaAsset({
      objectKey,
      bytes: result.bytes,
      contentType: result.mimeType,
    });
    await createGeneratedMediaAsset({
      id: mediaAssetId,
      workspaceId: input.workspaceId,
      objectKey,
      contentType: result.mimeType,
      sizeBytes: result.bytes.byteLength,
      width: result.width,
      height: result.height,
      title: input.title,
      altText: `Marketing graphic for ${input.title}`,
      createdByUserId: input.requestedByUserId,
    });
    await attachMediaToMarketingContent({
      workspaceId: input.workspaceId,
      contentItemId: input.contentItemId,
      mediaAssetId,
    });
    await reconcileMarketingUsage({
      workspaceId: input.workspaceId,
      runId: reservation.runId,
      reservationId: reservation.reservationId,
      operation: "image_generation",
      actualCostCents: cost,
      providerRequestId: result.requestId,
      safeMetadata: {
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        contentItemId: input.contentItemId,
      },
    });
    return mediaAssetId;
  } catch (error) {
    await failMarketingRun({
      workspaceId: input.workspaceId,
      runId: reservation.runId,
      reservationId: reservation.reservationId,
      operation: "image_generation",
      category: "campaign_image_failed",
      message: "A campaign graphic could not be generated.",
      chargedCostCents: estimatedCostCents,
    });
    throw error;
  }
}
