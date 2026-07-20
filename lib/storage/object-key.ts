import type { z } from "zod";
import { requestWorkspaceLogoUploadSchema } from "@/lib/schemas/workspace-logo";
import type { CharacterReferenceType } from "@/db/schema";
import type { SceneImageOutputFormat } from "@/lib/schemas/scene-image";

const extensionByContentType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type LogoUpload = z.infer<typeof requestWorkspaceLogoUploadSchema>;

export function createWorkspaceLogoObjectKey(input: {
  workspaceId: string;
  contentType: LogoUpload["contentType"];
}): string {
  const extension = extensionByContentType[input.contentType];
  return `workspaces/${input.workspaceId}/branding/logos/${crypto.randomUUID()}.${extension}`;
}

export function createCharacterReferenceObjectKey(input: {
  workspaceId: string;
  characterId: string;
  referenceType: CharacterReferenceType;
  contentType: keyof typeof extensionByContentType;
}): string {
  const extension = extensionByContentType[input.contentType];
  return `workspaces/${input.workspaceId}/characters/${input.characterId}/references/${input.referenceType}/${crypto.randomUUID()}.${extension}`;
}

export function isCharacterReferenceObjectKey(input: {
  workspaceId: string;
  characterId: string;
  referenceType: CharacterReferenceType;
  objectKey: string;
}): boolean {
  const prefix = `workspaces/${input.workspaceId}/characters/${input.characterId}/references/${input.referenceType}/`;
  return input.objectKey.startsWith(prefix) && !input.objectKey.includes("..");
}

export function isWorkspaceLogoObjectKey(input: {
  workspaceId: string;
  objectKey: string;
}): boolean {
  const prefix = `workspaces/${input.workspaceId}/branding/logos/`;
  return input.objectKey.startsWith(prefix) && !input.objectKey.includes("..");
}

/**
 * Object key for a cached voice-preview clip. Voice previews are shared,
 * workspace-agnostic system assets: a single clip per (model, voice, sample
 * text) is synthesized once and replayed by everyone. The key is fully derived
 * from a fixed allow-list (voice) plus sanitized model/hash segments, so no
 * untrusted input reaches the key.
 */
export function createVoicePreviewObjectKey(input: {
  model: string;
  voice: string;
  sampleHash: string;
}): string {
  const safe = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return `system/voice-previews/${safe(input.model)}/${safe(input.voice)}/${safe(input.sampleHash)}.mp3`;
}

export function createVideoExportObjectKey(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
}): string {
  return `workspaces/${input.workspaceId}/projects/${input.projectId}/renders/${input.renderId}.mp4`;
}

export function isVideoExportObjectKey(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  objectKey: string;
}): boolean {
  return (
    input.objectKey === createVideoExportObjectKey(input) &&
    !input.objectKey.includes("..")
  );
}

export function createSceneImageObjectKey(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  generationId: string;
  outputFormat: SceneImageOutputFormat;
}): string {
  return `workspaces/${input.workspaceId}/projects/${input.projectId}/scenes/${input.sceneId}/versions/${input.sceneVersionId}/images/${input.generationId}.${input.outputFormat}`;
}

export function isSceneImageObjectKey(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  generationId: string;
  outputFormat: SceneImageOutputFormat;
  objectKey: string;
}): boolean {
  return (
    input.objectKey === createSceneImageObjectKey(input) &&
    !input.objectKey.includes("..")
  );
}
