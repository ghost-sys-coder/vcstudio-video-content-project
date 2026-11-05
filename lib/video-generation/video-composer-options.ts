import type {
  VideoGenerationRequest,
  VideoGenerationTarget,
  VideoModelDescriptor,
} from "@studio/contracts/video";
export function defaultVideoRequest(
  model: VideoModelDescriptor,
  target: VideoGenerationTarget = { kind: "direct" },
): VideoGenerationRequest {
  const mode = model.modes.includes("text_to_video")
    ? "text_to_video"
    : model.modes[0]!;
  const output = model.outputs.find(
    (output) => !output.modes || output.modes.includes(mode),
  )!;
  return {
    modelId: model.id,
    title: "Untitled video",
    prompt: "",
    negativePrompt: "",
    mode,
    aspectRatio: output.aspectRatio,
    resolution: output.resolution,
    durationSeconds: output.durationsSeconds.includes(5)
      ? 5
      : output.durationsSeconds[0]!,
    audio: "none",
    seed: null,
    fit: "contain",
    inputs: [],
    target,
  };
}
export function videoOutputChoices(
  model: VideoModelDescriptor,
  request: VideoGenerationRequest,
) {
  const outputs = model.outputs.filter(
    (output) => !output.modes || output.modes.includes(request.mode),
  );
  const aspects = [...new Set(outputs.map((output) => output.aspectRatio))];
  const resolutions = [
    ...new Set(
      outputs
        .filter((output) => output.aspectRatio === request.aspectRatio)
        .map((output) => output.resolution),
    ),
  ];
  const output = outputs.find(
    (output) =>
      output.aspectRatio === request.aspectRatio &&
      output.resolution === request.resolution,
  );
  return { aspects, resolutions, durations: output?.durationsSeconds ?? [] };
}
export function videoMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
