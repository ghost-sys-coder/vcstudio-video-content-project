import type { z } from "zod";
import { requestWorkspaceLogoUploadSchema } from "@/lib/schemas/workspace-logo";

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

export function isWorkspaceLogoObjectKey(input: {
  workspaceId: string;
  objectKey: string;
}): boolean {
  const prefix = `workspaces/${input.workspaceId}/branding/logos/`;
  return input.objectKey.startsWith(prefix) && !input.objectKey.includes("..");
}
