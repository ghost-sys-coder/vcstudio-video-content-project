import { z } from "zod";
import { socialYouTubeSettingsSchema } from "./publishing";

export const MAX_SOCIAL_POST_DESTINATIONS = 20;
export const socialPostConnectionIdsSchema = z
  .array(z.uuid())
  .max(MAX_SOCIAL_POST_DESTINATIONS)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Choose each account only once.",
  );

export const mcpScopeSchema = z.enum([
  "vcstudio:read",
  "vcstudio:edit",
  "vcstudio:media",
  "vcstudio:review",
  "vcstudio:publish",
]);
export const MCP_SCOPES = mcpScopeSchema.options;
export type McpScope = z.infer<typeof mcpScopeSchema>;
export const mcpPublicationApprovalModeSchema = z.enum([
  "manual",
  "autonomous",
]);
export type McpPublicationApprovalMode = z.infer<
  typeof mcpPublicationApprovalModeSchema
>;
export const mcpGrantInput = z.object({
  connectionId: z.uuid(),
  workspaceId: z.uuid(),
  scopes: z.array(mcpScopeSchema).max(MCP_SCOPES.length),
  publicationApprovalMode: mcpPublicationApprovalModeSchema.default("manual"),
});
export const mcpWorkspaceInput = z.object({ workspaceId: z.uuid() });
/** Persisted display framing, distinct from a scene image's storage canvas. */
export const mcpSceneImageFramingSchema = z.object({
  outputVariantId: z.uuid(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  outputWidth: z.number().int().positive(),
  outputHeight: z.number().int().positive(),
  sourceImageGenerationId: z.uuid(),
  mode: z.enum(["contain", "cover"]),
  focalPointXBps: z.number().int().min(0).max(10000),
  focalPointYBps: z.number().int().min(0).max(10000),
  scaleBps: z.number().int().min(10000).max(30000),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type McpSceneImageFraming = z.infer<typeof mcpSceneImageFramingSchema>;
export const mcpMutationInput = mcpWorkspaceInput.extend({
  idempotencyKey: z.string().min(8).max(128),
});
export const mcpPageInput = mcpWorkspaceInput.extend({
  page: z.number().int().min(1).max(10000).default(1),
  pageSize: z.number().int().min(1).max(50).default(24),
});
export const mcpFileSchema = z.object({
  download_url: z.string().url().max(16384),
  file_id: z.string().min(1).max(500),
  mime_type: z.string().max(100).optional(),
  file_name: z.string().max(255).optional(),
});
export const mcpImportInput = mcpMutationInput.extend({
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("url"),
      url: z.string().url().max(16384),
      fileName: z.string().min(1).max(255),
    }),
    z.object({ kind: z.literal("file"), file: mcpFileSchema }),
    z.object({ kind: z.literal("upload") }),
  ]),
  title: z.string().max(200).default(""),
  attribution: z.string().max(300).default(""),
  destination: z
    .object({
      projectId: z.uuid().optional(),
      sceneId: z.uuid().optional(),
      postId: z.uuid().optional(),
    })
    .default({}),
});
export const mcpPublishInput = mcpMutationInput.extend({
  action: z.enum(["publish", "cancel_schedule", "retry_thumbnail"]).optional(),
  postId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  connectionIds: socialPostConnectionIdsSchema.refine(
    (ids) => ids.length > 0,
    "Choose at least one account.",
  ),
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
  timezone: z.string().max(100).default("UTC"),
});
export const mcpOperationStatusSchema = z.enum([
  "awaiting_upload",
  "requires_approval",
  "prepared",
  "queued",
  "running",
  "approved",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
]);
export type McpOperationStatus = z.infer<typeof mcpOperationStatusSchema>;
export const publicationPreviewSchema = z.object({
  action: z.enum(["publish", "cancel_schedule", "retry_thumbnail"]).optional(),
  postId: z.uuid(),
  version: z.number().int(),
  text: z.string(),
  media: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      contentType: z.string(),
      sizeBytes: z.number(),
      etag: z.string().nullable(),
    }),
  ),
  destinations: z.array(
    z.object({
      id: z.uuid(),
      platform: z.string(),
      name: z.string(),
      text: z.string(),
      youtube: socialYouTubeSettingsSchema
        .extend({
          thumbnail: z
            .object({
              id: z.uuid(),
              name: z.string(),
              contentType: z.string(),
              sizeBytes: z.number(),
              etag: z.string().nullable(),
            })
            .nullable(),
        })
        .optional(),
      existingVideoId: z.string().optional(),
    }),
  ),
  scheduledAt: z.string().nullable(),
  timezone: z.string(),
});
export type PublicationPreview = z.infer<typeof publicationPreviewSchema>;
export type McpPrincipal = {
  userId: string;
  clerkUserId: string;
  clientId: string;
  scopes: string[];
};
export type McpPublicOperation = {
  id: string;
  workspaceId: string;
  kind: string;
  status: McpOperationStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  expiresAt: string;
  href: string;
};
export type McpToolResult =
  { ok: true; data: unknown } | { ok: false; code: string; message: string };
