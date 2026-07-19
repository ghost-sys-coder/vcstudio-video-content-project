import { createHmac } from "node:crypto";

function hash(secret: string, parts: string[]): string {
  return createHmac("sha256", secret)
    .update(parts.join("\u001f"))
    .digest("hex");
}

export function createSceneAnalysisIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
  model: string;
  promptVersion: string;
}): string {
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    input.scriptVersionId,
    "scene-analysis",
    input.model,
    input.promptVersion,
  ]);
}

export function createSceneAnalysisRetryIdempotencyKey(input: {
  secret: string;
  failedRunId: string;
}): string {
  return hash(input.secret, ["scene-analysis-retry", input.failedRunId]);
}

export function createScriptGenerationIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  briefFingerprint: string;
  model: string;
  promptVersion: string;
  /** Distinct per intentional "Generate" click so regeneration yields a new run. */
  requestNonce: string;
}): string {
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    "script-generation",
    input.briefFingerprint,
    input.model,
    input.promptVersion,
    input.requestNonce,
  ]);
}

export function createSceneImageIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  promptTemplateVersion: string;
  stylePresetVersion: string;
  generationVersion: number;
  model: string;
  quality: string;
  size: string;
  outputFormat: string;
  outputCompression: number;
  background: string;
  referenceAssetIds: string[];
}): string {
  if (!Number.isInteger(input.generationVersion) || input.generationVersion < 1)
    throw new RangeError("Generation version must be a positive integer.");

  const orderedReferenceAssetIds = [...input.referenceAssetIds].sort();
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    input.sceneVersionId,
    "scene-image-generation",
    input.promptTemplateVersion,
    input.stylePresetVersion,
    String(input.generationVersion),
    input.model,
    input.quality,
    input.size,
    input.outputFormat,
    String(input.outputCompression),
    input.background,
    ...orderedReferenceAssetIds,
  ]);
}

export function createSceneAudioIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  voicePresetId: string;
  generationVersion: number;
  model: string;
  voice: string;
  format: string;
  speedScaledPercent: number;
}): string {
  if (!Number.isInteger(input.generationVersion) || input.generationVersion < 1)
    throw new RangeError("Generation version must be a positive integer.");
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    input.sceneVersionId,
    "scene-audio-generation",
    input.voicePresetId,
    String(input.generationVersion),
    input.model,
    input.voice,
    input.format,
    String(input.speedScaledPercent),
  ]);
}

export function createVideoRenderIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  preset: string;
  width: number;
  height: number;
  framesPerSecond: number;
  includeCaptions: boolean;
  includeWatermark: boolean;
  /** Hash of the frozen timeline snapshot (assets, timing, captions). */
  timelineFingerprint: string;
}): string {
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    "video-render",
    input.preset,
    String(input.width),
    String(input.height),
    String(input.framesPerSecond),
    input.includeCaptions ? "captions" : "no-captions",
    input.includeWatermark ? "watermark" : "no-watermark",
    input.timelineFingerprint,
  ]);
}

export function createRequestFingerprint(
  secret: string,
  prompt: string,
): string {
  return hash(secret, [prompt]);
}
