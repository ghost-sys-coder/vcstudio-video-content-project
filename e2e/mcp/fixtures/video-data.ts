import {
  VIDEO_MODELS,
  VIDEO_PRICES,
} from "@/lib/video-generation/video-model-catalog";
import type { VideoCatalogView } from "@/lib/video-generation/video-generation-view";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
export const videoWorkspace = "11111111-1111-4111-8111-111111111111",
  videoProject = "22222222-2222-4222-8222-222222222222",
  videoScene = "33333333-3333-4333-8333-333333333333",
  videoVersion = "44444444-4444-4444-8444-444444444444";
export const videoCatalog: VideoCatalogView = {
  enabled: true,
  elevenlabs: undefined,
  maximumCostCents: 150,
  dailyBudgetCents: 300,
  lifetimeBudgetCents: 1500,
  models: VIDEO_MODELS.map((model) => ({
    model,
    configured: true,
    pricedOutputs:
      VIDEO_PRICES.find((price) => price.modelId === model.id)?.rates.map(
        (rate) => rate.resolution,
      ) ?? [],
  })),
};
export const videoImageAsset: MediaAssetView = {
  id: "55555555-5555-4555-8555-555555555555",
  kind: "image",
  title: "Product reference",
  altText: "A green product reference",
  tags: [],
  contentType: "image/png",
  sizeBytes: 1024,
  width: 640,
  height: 360,
  durationMilliseconds: null,
  originalFileName: "product.png",
  createdAt: "2026-11-05T00:00:00.000Z",
  previewUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'%3E%3Crect width='640' height='360' fill='%23354d38'/%3E%3C/svg%3E",
};
export const videoClipAsset: MediaAssetView = {
  ...videoImageAsset,
  id: "66666666-6666-4666-8666-666666666666",
  kind: "video",
  title: "Inspected scene footage",
  contentType: "video/mp4",
  originalFileName: "scene.mp4",
  durationMilliseconds: 6000,
  previewUrl: "",
  verifiedMetadata: {
    kind: "video",
    codec: "h264",
    width: 640,
    height: 360,
    displayWidth: 640,
    displayHeight: 360,
    rotationDegrees: 0,
    averageFrameRate: 24,
    variableFrameRate: false,
    hasAudio: false,
    audioCodec: null,
    container: "mp4",
    durationMilliseconds: 6000,
  },
};
