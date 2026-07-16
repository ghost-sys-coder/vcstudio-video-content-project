import type { z } from "zod";
import { requestWorkspaceLogoUploadSchema } from "@/lib/schemas/workspace-logo";
import type { CharacterReferenceType } from "@/db/schema";

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
