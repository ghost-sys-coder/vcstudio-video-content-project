import { z } from "zod";

// Base64 + the MCP envelope stays below the existing 1 MiB request limit.
export const MCP_UPLOAD_CHUNK_BYTES = 512 * 1024;
export const MCP_UPLOAD_MAX_BYTES = 512 * 1024 * 1024;
export const MCP_UPLOAD_MAX_CHUNKS =
  MCP_UPLOAD_MAX_BYTES / MCP_UPLOAD_CHUNK_BYTES;
export const MCP_SERVER_VERSION = "1.1.0";
export const MCP_UPLOAD_RESOURCE = "ui://vcstudio/media-upload.html";
export const mcpUploadContentType = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
export const mcpUploadMetadata = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: mcpUploadContentType,
  sizeBytes: z.number().int().positive().max(MCP_UPLOAD_MAX_BYTES),
  fileFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().max(200).default(""),
  attribution: z.string().max(300).default(""),
});
const workspace = z.object({ workspaceId: z.uuid() });
export const mcpUploadStartInput = workspace.extend({
  idempotencyKey: z.string().min(8).max(128),
  ...mcpUploadMetadata.shape,
});
export const mcpUploadRef = workspace.extend({ uploadId: z.uuid() });
export const mcpUploadMutation = mcpUploadRef.extend({
  idempotencyKey: z.string().min(8).max(128),
});
export const mcpUploadChunkInput = mcpUploadMutation.extend({
  index: z
    .number()
    .int()
    .min(0)
    .max(MCP_UPLOAD_MAX_CHUNKS - 1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  dataBase64: z
    .string()
    .min(4)
    .max(4 * Math.ceil(MCP_UPLOAD_CHUNK_BYTES / 3))
    .regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .refine((value) => value.length % 4 === 0, "Use padded canonical base64."),
});
export const mcpUploadSessionSchema = z.object({
  uploadId: z.uuid(),
  workspaceId: z.uuid(),
  status: z.string(),
  expiresAt: z.string(),
  fileName: z.string(),
  sizeBytes: z.number(),
  fileFingerprint: z.string(),
  chunkBytes: z.literal(MCP_UPLOAD_CHUNK_BYTES),
  chunkCount: z.number().int(),
  receivedIndices: z.array(z.number().int()),
  receivedBytes: z.number(),
  mediaAssetId: z.uuid().nullable(),
  mediaStatus: z.string().nullable(),
  inspectionStatus: z.string().nullable(),
  error: z.string().nullable(),
});
export type McpUploadSession = z.infer<typeof mcpUploadSessionSchema>;
export type McpUploadMetadata = z.infer<typeof mcpUploadMetadata>;
export function mcpUploadKey(
  uploadId: string,
  action: "complete" | "cancel" | number,
  sha256 = "",
) {
  return `mcp-upload:${uploadId}:${action}${typeof action === "number" ? `:${sha256}` : ""}`;
}
