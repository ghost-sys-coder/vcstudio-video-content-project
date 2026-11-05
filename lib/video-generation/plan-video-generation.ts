import {
  videoGenerationRequestSchema,
  videoModelDescriptorSchema,
  videoModelPricingSchema,
  type VideoGenerationRequest,
  type VideoModelDescriptor,
  type VideoModelPricing,
} from "@studio/contracts/video";

export class VideoRequestNotSupportedError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "VideoRequestNotSupportedError";
  }
}

function refuse(code: string, message: string): never {
  throw new VideoRequestNotSupportedError(code, message);
}

/** Shared by estimates, submissions and worker preflight; never changes inputs. */
export function planVideoGeneration(input: {
  request: VideoGenerationRequest;
  model: VideoModelDescriptor;
  pricing: VideoModelPricing | null;
}) {
  const request = videoGenerationRequestSchema.parse(input.request);
  const model = videoModelDescriptorSchema.parse(input.model);
  if (model.retired)
    refuse(
      "model_retired",
      "This model is retired. Choose an available model.",
    );
  if (request.modelId !== model.id)
    refuse(
      "model_mismatch",
      "The selected model changed. Refresh the estimate.",
    );
  if (!model.modes.includes(request.mode))
    refuse(
      "mode_unsupported",
      "This model does not support the selected generation mode.",
    );
  if (request.prompt.length > model.maxPromptCharacters)
    refuse(
      "prompt_too_long",
      `This model accepts up to ${model.maxPromptCharacters} prompt characters.`,
    );
  if (request.negativePrompt && !model.supportsNegativePrompt)
    refuse(
      "negative_prompt_unsupported",
      "This model does not support a negative prompt.",
    );
  if (request.seed !== null && !model.supportsSeed)
    refuse("seed_unsupported", "This model does not support a seed.");
  if (!model.audioModes.includes(request.audio))
    refuse(
      "audio_unsupported",
      "This model does not support the selected audio output.",
    );
  if (request.audio === "native" && model.audioGeneration === "none")
    refuse("audio_unsupported", "This model does not generate audio.");
  if (request.inputs.length > model.maxInputs)
    refuse(
      "too_many_inputs",
      `This model accepts up to ${model.maxInputs} input assets.`,
    );
  if (request.inputs.some((asset) => !model.inputRoles.includes(asset.role)))
    refuse(
      "asset_role_unsupported",
      "An attached asset has a role this model does not support.",
    );
  const output = model.outputs.find(
    (option) =>
      (!option.modes || option.modes.includes(request.mode)) &&
      option.aspectRatio === request.aspectRatio &&
      option.resolution === request.resolution,
  );
  if (!output)
    refuse(
      "output_unsupported",
      "This model does not support the selected shape and resolution.",
    );
  if (!output.durationsSeconds.includes(request.durationSeconds))
    refuse(
      "duration_unsupported",
      "Choose a supported duration for this output.",
    );
  if (
    request.mode === "reference_to_video" &&
    model.referenceDurationsSeconds &&
    !model.referenceDurationsSeconds.includes(request.durationSeconds)
  )
    refuse(
      "reference_duration_unsupported",
      "Reference generation requires a different clip duration.",
    );
  const providerAudio =
    model.audioGeneration === "always" || request.audio === "native";
  if (!input.pricing)
    refuse(
      "pricing_unavailable",
      "Pricing must be configured before generation can start.",
    );
  const pricing = videoModelPricingSchema.parse(input.pricing);
  if (pricing.modelId !== model.id)
    refuse("pricing_mismatch", "The estimate does not match this model.");
  const matchesRate = (value: VideoModelPricing["rates"][number]) =>
    value.resolution === request.resolution &&
    (value.durationSeconds === undefined ||
      value.durationSeconds === request.durationSeconds) &&
    value.audio === (providerAudio ? "native" : "none");
  const rate =
    pricing.rates.find(
      (value) =>
        matchesRate(value) &&
        value.mode === request.mode &&
        value.durationSeconds === request.durationSeconds,
    ) ??
    pricing.rates.find(
      (value) =>
        matchesRate(value) &&
        value.mode === undefined &&
        value.durationSeconds === request.durationSeconds,
    ) ??
    pricing.rates.find(
      (value) => matchesRate(value) && value.mode === request.mode,
    ) ??
    pricing.rates.find(
      (value) => matchesRate(value) && value.mode === undefined,
    );
  if (!rate)
    refuse(
      "pricing_unavailable",
      "Pricing is unavailable for this resolution and audio configuration.",
    );
  // USD micros -> cents, rounded up once for the complete clip.
  const reservationDurationSeconds =
    model.durationControl === "prompt"
      ? Math.max(...output.durationsSeconds)
      : request.durationSeconds;
  const baseCostCents = Math.max(
    rate.minimumCents,
    Math.ceil((rate.usdMicrosPerSecond * reservationDurationSeconds) / 10_000),
  );
  const estimatedCostCents = Math.ceil(
    ((baseCostCents +
      pricing.overheadCents +
      pricing.perInputCents * request.inputs.length) *
      (10_000 + pricing.safetyMarginBps)) /
      10_000,
  );
  if (
    !Number.isSafeInteger(estimatedCostCents) ||
    estimatedCostCents > 100_000_000
  )
    refuse("cost_limit", "This generation exceeds the supported cost ceiling.");
  return {
    request,
    modelId: model.id,
    provider: model.provider,
    providerModelId: model.providerModelId,
    capabilityVersion: model.version,
    pricingRevision: pricing.revision,
    width: output.width,
    height: output.height,
    estimatedCostCents,
    reservationDurationSeconds,
    durationControl: model.durationControl,
    providerAudio,
    muteOutput: request.audio === "none",
    currency: "USD" as const,
  };
}
