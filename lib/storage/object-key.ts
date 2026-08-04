import type { z } from "zod";
import { requestWorkspaceLogoUploadSchema } from "@/lib/schemas/workspace-logo";
import type {
  CharacterReferenceType,
  SceneAudioAssetFormat,
} from "@/db/schema";
import type { SceneImageOutputFormat } from "@/lib/schemas/scene-image";
import {
  MEDIA_FILE_EXTENSION_BY_CONTENT_TYPE,
  type MediaContentType,
} from "@/lib/schemas/media-asset";
import {
  MARKETING_DOCUMENT_EXTENSIONS,
  type MarketingDocumentContentType,
} from "@/lib/schemas/marketing-document";

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
 * Object key for a media-library upload.
 *
 * Derived entirely from the asset's own UUID and its allow-listed content type —
 * no part of the user-supplied file name reaches the key, so a crafted name
 * cannot traverse or collide.
 *
 * Deliberately outside `createProjectAssetPrefix`: the library is a workspace
 * asset that outlives any one project, so purging a deleted project's prefix can
 * never take library media with it. Same reasoning as the note on that function.
 */
export function createMediaLibraryObjectKey(input: {
  workspaceId: string;
  mediaAssetId: string;
  contentType: MediaContentType;
}): string {
  const extension = MEDIA_FILE_EXTENSION_BY_CONTENT_TYPE[input.contentType];
  return `workspaces/${input.workspaceId}/library/${input.mediaAssetId}.${extension}`;
}

export function isMediaLibraryObjectKey(input: {
  workspaceId: string;
  mediaAssetId: string;
  contentType: MediaContentType;
  objectKey: string;
}): boolean {
  return (
    input.objectKey === createMediaLibraryObjectKey(input) &&
    !input.objectKey.includes("..")
  );
}

/**
 * Object key for a Marketing Studio knowledge document.
 *
 * Derived from the document's own UUID and its allow-listed content type — no
 * part of the uploaded file name reaches the key, so a crafted name can neither
 * traverse nor collide.
 *
 * Deliberately outside `createProjectAssetPrefix` **and** outside the media
 * library prefix: brand knowledge outlives any project, and it is not library
 * media that a post could attach.
 */
export function createMarketingDocumentObjectKey(input: {
  workspaceId: string;
  documentId: string;
  contentType: MarketingDocumentContentType;
}): string {
  const extension = MARKETING_DOCUMENT_EXTENSIONS[input.contentType];
  return `workspaces/${input.workspaceId}/marketing/documents/${input.documentId}.${extension}`;
}

export function isMarketingDocumentObjectKey(input: {
  workspaceId: string;
  documentId: string;
  contentType: MarketingDocumentContentType;
  objectKey: string;
}): boolean {
  return (
    input.objectKey === createMarketingDocumentObjectKey(input) &&
    !input.objectKey.includes("..")
  );
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

/**
 * The single R2 prefix every project-scoped asset lives under — renders,
 * thumbnails, scene images, and scene audio all nest beneath it (see the key
 * builders below, which must all keep starting with this).
 *
 * Deliberately does NOT cover character references
 * (`workspaces/{ws}/characters/...`), workspace logos, or voice previews: those
 * are workspace-level or shared assets that outlive any one project, so purging
 * this prefix when a project is deleted can never take them with it.
 */
export function createProjectAssetPrefix(input: {
  workspaceId: string;
  projectId: string;
}): string {
  return `workspaces/${input.workspaceId}/projects/${input.projectId}/`;
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

export function createThumbnailObjectKey(input: {
  workspaceId: string;
  projectId: string;
  platform: string;
  thumbnailGenerationId: string;
  outputFormat: SceneImageOutputFormat;
}): string {
  const safePlatform = input.platform.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `workspaces/${input.workspaceId}/projects/${input.projectId}/thumbnails/${safePlatform}/${input.thumbnailGenerationId}.${input.outputFormat}`;
}

export function isThumbnailObjectKey(input: {
  workspaceId: string;
  projectId: string;
  platform: string;
  thumbnailGenerationId: string;
  outputFormat: SceneImageOutputFormat;
  objectKey: string;
}): boolean {
  return (
    input.objectKey === createThumbnailObjectKey(input) &&
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

export function createSceneAudioObjectKey(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  generationId: string;
  format: SceneAudioAssetFormat;
}): string {
  return `workspaces/${input.workspaceId}/projects/${input.projectId}/scenes/${input.sceneId}/audio/${input.generationId}.${input.format}`;
}

export function isSceneAudioObjectKey(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  generationId: string;
  format: SceneAudioAssetFormat;
  objectKey: string;
}): boolean {
  return (
    input.objectKey === createSceneAudioObjectKey(input) &&
    !input.objectKey.includes("..")
  );
}
