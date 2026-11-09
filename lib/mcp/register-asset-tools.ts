import { MAX_SHOTS_PER_SCENE } from "@/lib/scenes/shot-timing";
import { z } from "zod";
import {
  mcpFileSchema,
  mcpImportInput,
  mcpMutationInput,
  mcpPageInput,
  mcpWorkspaceInput,
} from "@studio/contracts";
import { listMcpAssets } from "@/db/repositories/mcp-content.repository";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { findMcpOperation } from "@/db/repositories/mcp.repository";
import { updateMediaAssetDetails } from "@/db/commands/media-asset-commands";
import { updateMediaAssetSchema } from "@/lib/schemas/media-asset";
import { publicOperation, mutateOnce } from "./operations";
import { startMcpImport } from "./import-service";
import { assignMcpImage } from "./assign-image";
import { requireMcp } from "./errors";
import { enforceMcpRateLimit } from "./rate-limit";
import type { McpToolRegistrar } from "./register-tool";

export function registerAssetTools(register: McpToolRegistrar) {
  register(
    "list_assets",
    "Search a bounded page of verified workspace library assets. Does not download video or audio.",
    "vcstudio:read",
    mcpPageInput.extend({ search: z.string().max(200).optional() }),
    true,
    async (ctx, p) => {
      const rows = await listMcpAssets({ ...p, workspaceId: ctx.workspaceId });
      return {
        items: rows.slice(0, p.pageSize).map((a) => ({
          id: a.id,
          kind: a.kind,
          title: a.title,
          altText: a.altText,
          tags: a.tags,
          fileName: a.originalFileName,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          width: a.width,
          height: a.height,
          durationMilliseconds: a.durationMilliseconds,
        })),
        nextPage: rows.length > p.pageSize ? p.page + 1 : null,
      };
    },
  );
  register(
    "get_asset",
    "Inspect one workspace asset and its verification state; open its authorized download link when needed. Ready still images have been decoded and validated inline; inspectionStatus is for background video/audio inspection and may be null for images.",
    "vcstudio:read",
    mcpWorkspaceInput.extend({ mediaAssetId: z.uuid() }),
    true,
    async (ctx, p) => {
      const asset = await findMediaAsset({
        workspaceId: ctx.workspaceId,
        mediaAssetId: p.mediaAssetId,
      });
      requireMcp(
        asset && !asset.deletedAt,
        "not_found",
        "That asset is unavailable.",
      );
      return {
        id: asset.id,
        title: asset.title,
        fileName: asset.originalFileName,
        kind: asset.kind,
        contentType: asset.contentType,
        status: asset.status,
        inspectionStatus: asset.inspectionStatus,
        warnings: asset.inspectionWarnings,
        width: asset.width,
        height: asset.height,
        sizeBytes: asset.sizeBytes,
        href: `/app/mcp/assets/${asset.id}?workspaceId=${ctx.workspaceId}`,
      };
    },
  );
  register(
    "import_asset",
    "Import an authorized public HTTPS file, native file reference, or request an upload handoff. Stores a private copy; no generation or public posting.",
    "vcstudio:media",
    mcpImportInput,
    false,
    async (ctx, p) => {
      await enforceMcpRateLimit(ctx, "import");
      return startMcpImport(ctx, p);
    },
  );
  register(
    "import_chat_file",
    "Save an original file exposed by ChatGPT to VCStudio. Use only when this client supplies a real file reference; otherwise use open_media_upload to select the original inside chat, or the programmatic MCP chunk upload tools. Do not use Chrome as a substitute.",
    "vcstudio:media",
    mcpMutationInput.extend({
      file: mcpFileSchema,
      title: z.string().max(200).default(""),
      attribution: z.string().max(300).default(""),
    }),
    false,
    async (ctx, p) => {
      await enforceMcpRateLimit(ctx, "import");
      return startMcpImport(ctx, {
        ...p,
        source: { kind: "file", file: p.file },
        destination: {},
      });
    },
  );
  register(
    "update_asset_metadata",
    "Update a library asset's title, alt text and tags without changing its original bytes.",
    "vcstudio:media",
    mcpMutationInput.extend(updateMediaAssetSchema.shape),
    false,
    (ctx, p) =>
      mutateOnce(
        ctx,
        "update_asset_metadata",
        p.idempotencyKey,
        p,
        async () => {
          const asset = await updateMediaAssetDetails({
            ...p,
            workspaceId: ctx.workspaceId,
          });
          requireMcp(asset, "not_found", "That asset is unavailable.");
          return { mediaAssetId: asset.id };
        },
      ),
  );
  register(
    "assign_scene_image",
    "Use a ready, decoded PNG/JPEG/WebP library still in an approved scene. Default contain preserves all content; cover explicitly crops. Creates an unapproved project-owned copy at no generation charge. Returns importFit, storage-canvas dimensions and persisted outputFraming separately. The accepted scene canvas can differ from the final video size; contain display preserves it within that output.",
    "vcstudio:media",
    mcpMutationInput.extend({
      projectId: z.uuid(),
      sceneId: z.uuid(),
      expectedVersion: z.number().int().positive(),
      mediaAssetId: z.uuid(),
      fit: z.enum(["contain", "cover"]).default("contain"),
      shotIndex: z
        .number()
        .int()
        .min(0)
        .max(MAX_SHOTS_PER_SCENE - 1)
        .default(0),
    }),
    false,
    (ctx, p) => assignMcpImage(ctx, p.idempotencyKey, p),
  );
  register(
    "get_operation",
    "Check one durable import, edit or publication request. Call only when needed; avoid continuous background polling.",
    "vcstudio:read",
    mcpWorkspaceInput.extend({ operationId: z.uuid() }),
    true,
    async (ctx, p) => {
      const op = await findMcpOperation({
        operationId: p.operationId,
        workspaceId: ctx.workspaceId,
        userId: ctx.principal.userId,
        connectionId: ctx.connection.id,
      });
      requireMcp(op, "not_found", "That operation is unavailable.");
      if (op.kind === "import_asset" && op.status === "succeeded") {
        const asset = await findMediaAsset({
          workspaceId: ctx.workspaceId,
          mediaAssetId: op.id,
        });
        return {
          ...publicOperation(op),
          media: asset
            ? {
                id: asset.id,
                status: asset.status,
                inspectionStatus: asset.inspectionStatus,
                error: asset.inspectionError,
              }
            : null,
        };
      }
      return publicOperation(op);
    },
  );
}
