import "server-only";
import type { VideoGeneration } from "@/db/schema";
import { listVideoGenerations } from "@/db/repositories/video-generations.repository";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import { VIDEO_MODELS, findVideoPricing } from "./video-model-catalog";
import { getVideoGenerationEnvironment } from "@/lib/env/server";
import { videoProviderConfigured } from "./video-environment";
import {
  encodeLibraryCursor,
  decodeLibraryCursor,
} from "@/lib/media/library-cursor";

export function videoGenerationSummary(job: VideoGeneration) {
  return {
    id: job.id,
    title: job.request.title,
    prompt: job.request.prompt,
    model: job.modelSnapshot.name,
    modelId: job.request.modelId,
    status: job.status,
    aspectRatio: job.request.aspectRatio,
    resolution: job.request.resolution,
    durationSeconds: job.request.durationSeconds,
    audio: job.request.audio,
    target: job.request.target,
    targetDetached: job.targetDetached,
    estimatedCostCents: job.estimatedCostCents,
    actualCostCents: job.actualCostCents,
    outputAssetId: job.outputAssetId,
    errorCode: job.errorCode,
    safeErrorMessage: job.safeErrorMessage,
    canResume:
      job.status === "queued" ||
      Boolean(
        job.providerJobId &&
        (["running", "inspecting", "requires_reconciliation"].includes(
          job.status,
        ) ||
          (job.status === "succeeded" && job.actualCostCents === null)),
      ),
    createdAt: job.createdAt.toISOString(),
  };
}
export type VideoGenerationView = ReturnType<typeof videoGenerationSummary>;
export function videoCatalogView() {
  const environment = getVideoGenerationEnvironment();
  return {
    enabled: environment.ENABLE_VIDEO_GENERATION,
    maximumCostCents: environment.VIDEO_GENERATION_MAX_COST_CENTS,
    dailyBudgetCents: environment.VIDEO_GENERATION_DAILY_BUDGET_CENTS,
    lifetimeBudgetCents: environment.VIDEO_GENERATION_LIFETIME_BUDGET_CENTS,
    models: VIDEO_MODELS.map((model) => ({
      model,
      configured: videoProviderConfigured(model.provider, environment),
      pricedOutputs:
        findVideoPricing(
          model.id,
          environment.VIDEO_GENERATION_PRICING_JSON,
        )?.rates.map((rate) => rate.resolution) ?? [],
    })),
  };
}
export type VideoCatalogView = ReturnType<typeof videoCatalogView>;
export async function videoHistoryView(workspaceId: string, cursor?: string) {
  const decoded = decodeLibraryCursor(cursor);
  const jobs = await listVideoGenerations({
    workspaceId,
    cursor: decoded
      ? { createdAt: new Date(decoded.createdAt), id: decoded.id }
      : undefined,
  });
  const page = jobs.slice(0, 24);
  const last = page.at(-1);
  return {
    items: page.map(videoGenerationSummary),
    nextCursor:
      jobs.length > 24 && last
        ? encodeLibraryCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
            direction: "next",
          })
        : null,
  };
}
export async function videoOutputUrl(
  workspaceId: string,
  job: VideoGeneration,
) {
  if (job.status !== "succeeded" || !job.outputAssetId) return null;
  const asset = await findMediaAsset({
    workspaceId,
    mediaAssetId: job.outputAssetId,
  });
  if (
    !asset ||
    asset.status !== "ready" ||
    asset.deletedAt ||
    asset.inspectionStatus !== "succeeded"
  )
    return null;
  return createMediaAssetDownloadUrl(asset.objectKey, 300);
}
