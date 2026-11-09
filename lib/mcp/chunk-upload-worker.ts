import "server-only";
import { mcpUploadMetadata } from "@studio/contracts/mcp-upload";
import type { McpOperation } from "@/db/repositories/mcp.repository";
import { setMcpPendingAssetSize } from "@/db/repositories/mcp.repository";
import { createPendingMediaAsset } from "@/db/commands/media-asset-commands";
import { createMediaLibraryObjectKey } from "@/lib/storage/object-key";
import { MEDIA_ASSET_KIND_BY_CONTENT_TYPE } from "@/lib/schemas/media-asset";
import type { McpContext } from "./context";
import { authorizeMcpBrowser } from "./context";
import { readMcpChunks, removeMcpChunks } from "./chunk-upload-storage";
import { streamImportObject } from "./import-storage";

export async function runMcpChunkImport(
  ctx: McpContext,
  op: McpOperation,
  finish: () => Promise<unknown>,
) {
  const meta = mcpUploadMetadata.parse(op.input),
    objectKey = createMediaLibraryObjectKey({
      workspaceId: ctx.workspaceId,
      mediaAssetId: op.id,
      contentType: meta.contentType,
    });
  await createPendingMediaAsset({
    id: op.id,
    workspaceId: ctx.workspaceId,
    kind: MEDIA_ASSET_KIND_BY_CONTENT_TYPE[meta.contentType],
    objectKey,
    contentType: meta.contentType,
    sizeBytes: 0,
    originalFileName: meta.fileName,
    uploadedByUserId: ctx.principal.userId,
    durationMilliseconds: null,
  });
  const sizeBytes = await streamImportObject({
    objectKey,
    contentType: meta.contentType,
    maximumBytes: meta.sizeBytes,
    body: readMcpChunks({
      workspaceId: ctx.workspaceId,
      uploadId: op.id,
      sizeBytes: meta.sizeBytes,
      fileFingerprint: meta.fileFingerprint,
    }),
  });
  await setMcpPendingAssetSize(ctx.workspaceId, op.id, sizeBytes);
  await authorizeMcpBrowser(
    op.userId,
    op.connectionId,
    ctx.workspaceId,
    "vcstudio:media",
  );
  await finish();
  try {
    await removeMcpChunks(ctx.workspaceId, op.id);
    // Existing scheduled cleanup rechecks after the grace period for late PUTs.
  } catch {
    console.error("MCP completed chunk cleanup deferred", { uploadId: op.id });
  }
}
