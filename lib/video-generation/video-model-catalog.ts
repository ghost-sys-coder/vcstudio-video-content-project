import {
  videoModelDescriptorSchema,
  videoModelPricingSchema,
  type VideoModelDescriptor,
  type VideoModelPricing,
} from "@studio/contracts/video";

const durations = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const verifiedAt = "2026-11-05";
const runwayOutputs = [
  { aspectRatio: "16:9", width: 1280, height: 720 },
  { aspectRatio: "9:16", width: 720, height: 1280 },
  { aspectRatio: "1:1", width: 960, height: 960 },
  { aspectRatio: "4:3", width: 1104, height: 832 },
  { aspectRatio: "3:4", width: 832, height: 1104 },
  { aspectRatio: "21:9", width: 1584, height: 672 },
].map((shape, index) => ({
  ...shape,
  resolution: "720p",
  durationsSeconds: durations(2, 10),
  modes: index < 2 ? ["text_to_video", "image_to_video"] : ["image_to_video"],
}));

/** Verified protocols only. Credentials and account access are separate from this catalog. */
export const VIDEO_MODELS: VideoModelDescriptor[] = [
  videoModelDescriptorSchema.parse({
    id: "google-omni-1.1",
    provider: "google_gemini",
    providerModelId: "gemini-omni-1.1-flash",
    name: "Gemini Omni 1.1 Flash",
    description:
      "Google's video model, with image references and native sound. Duration is prompt-guided; reserve for up to 10 seconds.",
    version: "2026-11-05.1",
    modes: ["text_to_video", "image_to_video", "reference_to_video"],
    outputs: [
      { resolution: "360p", width: 640, height: 360 },
      { resolution: "720p", width: 1280, height: 720 },
      { resolution: "1080p", width: 1920, height: 1080 },
      { resolution: "4k", width: 3840, height: 2160 },
    ].flatMap((shape) => [
      { ...shape, aspectRatio: "16:9", durationsSeconds: durations(3, 10) },
      {
        ...shape,
        width: shape.height,
        height: shape.width,
        aspectRatio: "9:16",
        durationsSeconds: durations(3, 10),
      },
    ]),
    inputRoles: [
      "first_frame",
      "last_frame",
      "reference",
      "character",
      "product",
      "style",
    ],
    maxInputs: 4,
    audioModes: ["none", "native"],
    audioGeneration: "always",
    durationControl: "prompt",
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsCancellation: false,
    maxPromptCharacters: 4000,
    documentationUrl: "https://aistudio.google.com/docs/omni",
    verifiedAt,
  }),
  ...["gen4.5", "gen4_turbo"].map((model) =>
    videoModelDescriptorSchema.parse({
      id: `runway-${model}`,
      provider: "runway",
      providerModelId: model,
      name: model === "gen4.5" ? "Runway Gen-4.5" : "Runway Gen-4 Turbo",
      description:
        model === "gen4.5"
          ? "Text or first-frame motion with precise clip duration."
          : "Fast first-frame animation with precise clip duration.",
      version: "2026-11-05.1",
      modes:
        model === "gen4.5"
          ? ["text_to_video", "image_to_video"]
          : ["image_to_video"],
      outputs: runwayOutputs.map((output) => ({
        ...output,
        modes: model === "gen4.5" ? output.modes : ["image_to_video"],
      })),
      inputRoles: ["first_frame"],
      maxInputs: 1,
      audioModes: ["none"],
      audioGeneration: "none",
      durationControl: "strict",
      supportsSeed: true,
      supportsNegativePrompt: false,
      supportsCancellation: true,
      maxPromptCharacters: 1000,
      documentationUrl: "https://docs.dev.runwayml.com/api/",
      verifiedAt,
    }),
  ),
  videoModelDescriptorSchema.parse({
    id: "luma-ray-3.2",
    provider: "luma",
    providerModelId: "ray-3.2",
    name: "Luma Ray 3.2",
    description:
      "Cinematic text or first/last-frame motion. Silent SDR clips; 10 seconds is available for text generation only.",
    version: "2026-11-05.1",
    modes: ["text_to_video", "image_to_video"],
    outputs: [360, 540, 720, 1080].flatMap((size) =>
      ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].flatMap((aspectRatio) => {
        const [x, y] = aspectRatio.split(":").map(Number);
        const unit = size / Math.min(x!, y!);
        return ["text_to_video", "image_to_video"].map((mode) => ({
          aspectRatio,
          resolution: `${size}p`,
          width: Math.round((x! * unit) / 2) * 2,
          height: Math.round((y! * unit) / 2) * 2,
          modes: [mode],
          durationsSeconds: mode === "text_to_video" ? [5, 10] : [5],
        }));
      }),
    ),
    inputRoles: ["first_frame", "last_frame"],
    maxInputs: 2,
    audioModes: ["none"],
    audioGeneration: "none",
    durationControl: "strict",
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsCancellation: false,
    maxPromptCharacters: 6000,
    documentationUrl:
      "https://docs.agents.lumalabs.ai/guides/videos/generation/",
    verifiedAt,
  }),
  ...["veo-3.1-fast-generate-001", "veo-3.1-generate-001"].map(
    (providerModelId) =>
      videoModelDescriptorSchema.parse({
        id: `elevenlabs-${providerModelId}`,
        provider: "elevenlabs",
        providerModelId,
        name: providerModelId.includes("fast")
          ? "ElevenLabs · Veo 3.1 Fast"
          : "ElevenLabs · Veo 3.1",
        description:
          "Private in-house service. Requires ElevenLabs Pro API access and explicit pricing. Optional native sound; project scenes retain narration.",
        version: "2026-11-10.1",
        modes: ["text_to_video", "image_to_video", "reference_to_video"],
        outputs: [
          {
            resolution: "720p",
            width: 1280,
            height: 720,
            durationsSeconds: [4, 6, 8],
          },
          {
            resolution: "1080p",
            width: 1920,
            height: 1080,
            durationsSeconds: [8],
          },
        ].flatMap((shape) => [
          { ...shape, aspectRatio: "16:9" },
          {
            ...shape,
            aspectRatio: "9:16",
            width: shape.height,
            height: shape.width,
          },
        ]),
        inputRoles: [
          "first_frame",
          "last_frame",
          "reference",
          "character",
          "product",
          "style",
        ],
        maxInputs: 3,
        referenceDurationsSeconds: [8],
        audioModes: ["none", "native"],
        audioGeneration: "optional",
        durationControl: "strict",
        supportsSeed: true,
        supportsNegativePrompt: true,
        supportsCancellation: false,
        maxPromptCharacters: 4000,
        documentationUrl:
          "https://elevenlabs.io/docs/api-reference/flows/video/create",
        verifiedAt: "2026-11-10",
      }),
  ),
];

export const VIDEO_PRICES: VideoModelPricing[] = [
  videoModelPricingSchema.parse({
    modelId: "google-omni-1.1",
    revision: "2026-11-05.1",
    currency: "USD",
    sourceUrl: "https://aistudio.google.com/docs/pricing#gemini-omni-1.1-flash",
    // Includes a conservative input/thinking allowance. Actual tokens settle separately.
    overheadCents: 20,
    perInputCents: 2,
    safetyMarginBps: 1000,
    tokenPricing: {
      inputUsdPerMillion: 1.5,
      textUsdPerMillion: 9,
      videoUsdPerMillion: 17.5,
    },
    rates: [
      // 5792 video tokens/sec * $17.50/M. Google's launch guide prices 360p at one third.
      {
        resolution: "360p",
        audio: "native",
        usdMicrosPerSecond: 33787,
        minimumCents: 1,
      },
      {
        resolution: "720p",
        audio: "native",
        usdMicrosPerSecond: 101360,
        minimumCents: 1,
      },
    ],
  }),
  ...[
    { model: "gen4.5", micros: 120000 },
    { model: "gen4_turbo", micros: 50000 },
  ].map((rate) =>
    videoModelPricingSchema.parse({
      modelId: `runway-${rate.model}`,
      revision: "2026-11-05.1",
      currency: "USD",
      sourceUrl: "https://docs.dev.runwayml.com/guides/pricing/",
      rates: [
        {
          resolution: "720p",
          audio: "none",
          usdMicrosPerSecond: rate.micros,
          minimumCents: 1,
        },
      ],
    }),
  ),
  videoModelPricingSchema.parse({
    modelId: "luma-ray-3.2",
    revision: "2026-11-05-list",
    currency: "USD",
    sourceUrl: "https://docs.agents.lumalabs.ai/guides/pricing/",
    // Default list rate $0.003/credit; an account contract must override this snapshot.
    creditUsdMicros: 3000,
    rates: [
      { resolution: "360p", credits: 20 },
      { resolution: "540p", credits: 50 },
      { resolution: "720p", credits: 100 },
      { resolution: "1080p", credits: 400 },
    ].flatMap((row) =>
      [5, 10].map((durationSeconds) => ({
        resolution: row.resolution,
        audio: "none",
        durationSeconds,
        usdMicrosPerSecond:
          (row.credits * (durationSeconds === 10 ? 3 : 1) * 3000) /
          durationSeconds,
        minimumCents: 1,
      })),
    ),
  }),
];

export function findVideoModel(modelId: string) {
  return VIDEO_MODELS.find((model) => model.id === modelId) ?? null;
}
export function findVideoPricing(
  modelId: string,
  overrides: VideoModelPricing[] = [],
) {
  return (
    overrides.find((price) => price.modelId === modelId) ??
    VIDEO_PRICES.find((price) => price.modelId === modelId) ??
    null
  );
}
