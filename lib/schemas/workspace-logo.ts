import { z } from "zod";

export const MAX_WORKSPACE_LOGO_BYTES = 5 * 1024 * 1024;
export const WORKSPACE_LOGO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const contentTypeSchema = z.enum(WORKSPACE_LOGO_CONTENT_TYPES);

export const requestWorkspaceLogoUploadSchema = z.object({
  contentType: contentTypeSchema,
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_WORKSPACE_LOGO_BYTES),
});

export const completeWorkspaceLogoUploadSchema = z.object({
  contentType: contentTypeSchema,
  objectKey: z.string().min(1).max(512),
  sizeBytes: z.number().int().positive().max(MAX_WORKSPACE_LOGO_BYTES),
});
