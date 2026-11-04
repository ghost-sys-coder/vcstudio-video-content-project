import "server-only";
import { getMcpEnvironment } from "@/lib/env/server";
import {
  listMcpRecoveryOperations,
  revokeExpiredMcpSecrets,
  updateMcpOperation,
  listMcpAbandonedImports,
  releaseAbandonedMcpPostLocks,
} from "@/db/repositories/mcp.repository";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { markMediaAssetFailed } from "@/db/commands/media-asset-commands";
import { deleteMediaAssetObject } from "@/lib/storage/media-asset-storage";
import { dispatchApprovedPublication } from "./publishing-service";
import { mediaContentTypeSchema } from "@/lib/schemas/media-asset";
import { createMediaLibraryObjectKey } from "@/lib/storage/object-key";
export async function recoverMcpOperations() {
  if (!getMcpEnvironment().ENABLE_MCP) return { recovered: 0 };
  const rows = await listMcpRecoveryOperations();
  let recovered = 0;
  for (const op of rows) {
    if (op.status === "approved") {
      await dispatchApprovedPublication(op);
      recovered++;
    } else if (op.status === "running" && op.expiresAt <= new Date()) {
      const asset =
        op.kind === "import_asset"
          ? await findMediaAsset({
              workspaceId: op.workspaceId,
              mediaAssetId: op.id,
            })
          : null;
      await updateMcpOperation({
        operationId: op.id,
        workspaceId: op.workspaceId,
        from: ["running"],
        values:
          asset?.status === "ready"
            ? {
                status: "succeeded",
                sealedSource: null,
                result: { mediaAssetId: asset.id, href: "/app/social/library" },
              }
            : {
                status: "failed",
                sealedSource: null,
                error:
                  "The request stopped before its result was recorded. Inspect current content before making a new request.",
              },
      });
      recovered++;
    }
  }
  await revokeExpiredMcpSecrets();
  await releaseAbandonedMcpPostLocks();
  return { recovered };
}
export async function cleanMcpImports(dryRun: boolean) {
  if (!getMcpEnvironment().ENABLE_MCP) return { cleaned: 0, dryRun };
  let cleaned = 0;
  for (const { asset, operationId } of await listMcpAbandonedImports(25)) {
    const type = mediaContentTypeSchema.parse(asset.contentType);
    if (
      asset.objectKey.replace(/\.verified$/, "") !==
      createMediaLibraryObjectKey({
        workspaceId: asset.workspaceId,
        mediaAssetId: asset.id,
        contentType: type,
      })
    )
      continue;
    if (!dryRun) {
      await deleteMediaAssetObject(asset.objectKey);
      await markMediaAssetFailed({
        workspaceId: asset.workspaceId,
        mediaAssetId: asset.id,
      });
      await updateMcpOperation({
        operationId,
        workspaceId: asset.workspaceId,
        from: ["failed", "cancelled", "expired"],
        values: { sealedSource: null, result: { storageCleaned: true } },
      });
    }
    cleaned++;
  }
  return { cleaned, dryRun };
}
