import type {
  VideoGenerationRequest,
  VideoModelDescriptor,
  VideoModelPricing,
} from "@studio/contracts/video";

/** Synthetic fixtures for deterministic tests; never a selectable production model. */
export const syntheticVideoModel: VideoModelDescriptor = {
  id: "test-video",
  provider: "google_gemini",
  providerModelId: "test-only",
  name: "Test video",
  description: "Synthetic test fixture",
  version: "test-v1",
  modes: ["text_to_video", "image_to_video", "reference_to_video"],
  outputs: [
    {
      aspectRatio: "16:9",
      resolution: "720p",
      width: 1280,
      height: 720,
      durationsSeconds: [4, 8],
    },
  ],
  inputRoles: [
    "first_frame",
    "last_frame",
    "reference",
    "product",
    "character",
  ],
  maxInputs: 3,
  audioModes: ["none", "native"],
  audioGeneration: "optional",
  durationControl: "strict",
  supportsSeed: true,
  supportsNegativePrompt: true,
  supportsCancellation: false,
  maxPromptCharacters: 4000,
  documentationUrl: "https://example.invalid/test-video",
  verifiedAt: "2026-11-05",
  retired: false,
};
export const syntheticVideoPricing: VideoModelPricing = {
  modelId: "test-video",
  revision: "test-rate-1",
  currency: "USD",
  sourceUrl: "https://example.invalid/pricing",
  overheadCents: 0,
  perInputCents: 0,
  safetyMarginBps: 0,
  rates: [
    {
      resolution: "720p",
      audio: "none",
      usdMicrosPerSecond: 25_001,
      minimumCents: 1,
    },
    {
      resolution: "720p",
      audio: "native",
      usdMicrosPerSecond: 50_000,
      minimumCents: 1,
    },
  ],
};
export const syntheticVideoRequest: VideoGenerationRequest = {
  modelId: "test-video",
  title: "Test clip",
  prompt: "A gentle camera move across a studio desk.",
  negativePrompt: "",
  mode: "text_to_video",
  aspectRatio: "16:9",
  resolution: "720p",
  durationSeconds: 4,
  audio: "none",
  seed: null,
  fit: "contain",
  inputs: [],
  target: { kind: "direct" },
};
