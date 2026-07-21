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

export function createTitleGenerationIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  platform: string;
  briefFingerprint: string;
  model: string;
  promptVersion: string;
  /** Distinct per intentional "Generate" click so regeneration yields a new run. */
  requestNonce: string;
}): string {
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    "title-generation",
    input.platform,
    input.briefFingerprint,
    input.model,
    input.promptVersion,
    input.requestNonce,
  ]);
}

export function createVideoPublicationIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  renderId: string;
  connectionId: string;
  platform: string;
  /** Distinct per intentional "Publish" click so a deliberate re-upload is allowed. */
  requestNonce: string;
}): string {
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    "video-publication",
    input.renderId,
    input.connectionId,
    input.platform,
    input.requestNonce,
  ]);
}

export function createThumbnailGenerationIdempotencyKey(input: {
  secret: string;
  workspaceId: string;
  projectId: string;
  platform: string;
  textMode: string;
  headlineText: string;
  briefFingerprint: string;
  model: string;
  quality: string;
  size: string;
  promptVersion: string;
  /** Distinct per intentional "Generate" click so regeneration yields a new run. */
  requestNonce: string;
}): string {
  return hash(input.secret, [
    input.workspaceId,
    input.projectId,
    "thumbnail-generation",
    input.platform,
    input.textMode,
    input.headlineText,
    input.briefFingerprint,
    input.model,
    input.quality,
    input.size,
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
  /**
   * Distinguishes a fresh render of an otherwise-identical timeline after a
   * prior render for it reached a terminal failed/cancelled state. `0` (the
   * default) leaves the key unchanged, so an in-flight or already-succeeded
   * render of the same timeline is still reused (never re-billed); a higher
   * value mints a new key so a retry is not silently deduplicated against the
   * terminal render.
   */
  attempt?: number;
}): string {
  const elements = [
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
  ];
  if (input.attempt && input.attempt > 0)
    elements.push(`attempt-${input.attempt}`);
  return hash(input.secret, elements);
}

export function createRequestFingerprint(
  secret: string,
  prompt: string,
): string {
  return hash(secret, [prompt]);
}
