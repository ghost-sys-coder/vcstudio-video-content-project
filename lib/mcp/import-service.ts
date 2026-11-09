import "server-only";
import { z } from "zod";
import sharp from "sharp";
import { tasks } from "@trigger.dev/sdk";
import { mcpImportInput } from "@studio/contracts";
import {
  beginMcpOperation,
  findMcpOperation,
  updateMcpOperation,
  addMcpAssetOrigin,
  setMcpPendingAssetObject,
} from "@/db/repositories/mcp.repository";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import {
  createPendingMediaAsset,
  markMediaAssetFailed,
  markMediaAssetReady,
} from "@/db/commands/media-asset-commands";
import {
  attachMediaAssetInspectionRun,
  prepareMediaAssetInspection,
} from "@/db/commands/media-inspection-commands";
import { createMediaLibraryObjectKey } from "@/lib/storage/object-key";
import {
  createMediaAssetUploadUrl,
  deleteMediaAssetObject,
  downloadMediaAssetBytes,
  inspectMediaAsset,
} from "@/lib/storage/media-asset-storage";
import {
  mediaContentTypeSchema,
  MEDIA_ASSET_KIND_BY_CONTENT_TYPE,
  sanitizeMediaFileName,
  requestMediaUploadSchema,
} from "@/lib/schemas/media-asset";
import {
  getMediaLibraryEnvironment,
  getPublishingEnvironment,
} from "@/lib/env/server";
import { sealSecret, openSecret } from "@/lib/crypto/secret-box";
import type { mediaInspectionTask } from "@/trigger/media-inspection";
import type { mcpMediaImportTask } from "@/trigger/mcp-media-import";
import { authorizeMcpBrowser, type McpContext } from "./context";
import { fingerprint } from "./fingerprint";
import { publicOperation } from "./operations";
import { requireMcp, McpError } from "./errors";
import { safeSourceUrl, withPublicDownload } from "./safe-download";
import { streamImportObject } from "./import-storage";
import { setMcpPendingAssetSize } from "@/db/repositories/mcp.repository";
import { freezeMcpUpload } from "./storage-integrity";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { updateMediaAssetDetails } from "@/db/commands/media-asset-commands";
import { runMcpChunkImport } from "./chunk-upload-worker";

export async function startMcpImport(
  context: McpContext,
  input: z.infer<typeof mcpImportInput>,
) {
  const sourceUrl =
    input.source.kind === "url"
      ? input.source.url
      : input.source.kind === "file"
        ? input.source.file.download_url
        : null;
  if (sourceUrl) safeSourceUrl(sourceUrl);
  const publicInput = {
    title: input.title,
    attribution: input.attribution,
    destination: input.destination,
    fileName:
      input.source.kind === "url"
        ? input.source.fileName
        : input.source.kind === "file"
          ? (input.source.file.file_name ?? "imported-file")
          : "",
    sourceKind: input.source.kind,
    contentTypeHint:
      input.source.kind === "file" ? input.source.file.mime_type : undefined,
  };
  const started = await beginMcpOperation({
    workspaceId: context.workspaceId,
    userId: context.principal.userId,
    connectionId: context.connection.id,
    idempotencyKey: input.idempotencyKey,
    kind: "import_asset",
    fingerprint: fingerprint(input),
    input: publicInput,
    status: sourceUrl ? "queued" : "awaiting_upload",
    expiresAt: new Date(Date.now() + 3600_000),
    sealedSource: sourceUrl
      ? sealSecret({
          plaintext: sourceUrl,
          key: getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY,
        })
      : null,
  });
  requireMcp(
    started.operation.fingerprint === fingerprint(input),
    "conflict",
    "That request key was used for a different import.",
  );
  if (started.created && sourceUrl) {
    try {
      const handle = await tasks.trigger<typeof mcpMediaImportTask>(
        "mcp-media-import",
        { workspaceId: context.workspaceId, operationId: started.operation.id },
        { idempotencyKey: `mcp-import:${started.operation.id}` },
      );
      await updateMcpOperation({
        operationId: started.operation.id,
        workspaceId: context.workspaceId,
        from: ["queued", "running"],
        values: { triggerRunId: handle.id },
      });
    } catch {
      await updateMcpOperation({
        operationId: started.operation.id,
        workspaceId: context.workspaceId,
        from: ["queued"],
        values: {
          status: "failed",
          sealedSource: null,
          error:
            "The import worker is unavailable. Use upload or try a fresh request later.",
        },
      });
      throw new McpError(
        "worker_unavailable",
        "The import worker is unavailable. Use the MCP upload panel or retry later.",
      );
    }
  }
  const current = await findMcpOperation({
    operationId: started.operation.id,
    workspaceId: context.workspaceId,
  });
  return publicOperation(current ?? started.operation);
}
export async function authorizeMcpUpload(
  context: McpContext,
  operationId: string,
  raw: unknown,
) {
  const input = requestMediaUploadSchema.parse(raw);
  const op = await findMcpOperation({
    workspaceId: context.workspaceId,
    connectionId: context.connection.id,
    userId: context.principal.userId,
    operationId,
  });
  requireMcp(
    op?.kind === "import_asset" &&
      op.input.sourceKind === "upload" &&
      op.status === "awaiting_upload" &&
      op.expiresAt > new Date(),
    "expired",
    "This upload request expired or is unavailable.",
  );
  requireMcp(
    MEDIA_ASSET_KIND_BY_CONTENT_TYPE[input.contentType] !== "audio",
    "unsupported_media",
    "MCP v1 imports images and videos.",
  );
  const limits = getMediaLibraryEnvironment();
  const max =
    MEDIA_ASSET_KIND_BY_CONTENT_TYPE[input.contentType] === "image"
      ? limits.MAX_MEDIA_IMAGE_BYTES
      : limits.MAX_MEDIA_VIDEO_BYTES;
  requireMcp(
    input.sizeBytes <= max,
    "file_too_large",
    "That file exceeds the upload limit.",
  );
  const objectKey = createMediaLibraryObjectKey({
    workspaceId: context.workspaceId,
    mediaAssetId: op.id,
    contentType: input.contentType,
  });
  const existing = await findMediaAsset({
    workspaceId: context.workspaceId,
    mediaAssetId: op.id,
  });
  if (!existing)
    await createPendingMediaAsset({
      id: op.id,
      workspaceId: context.workspaceId,
      kind: MEDIA_ASSET_KIND_BY_CONTENT_TYPE[input.contentType],
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      originalFileName: input.fileName,
      durationMilliseconds: null,
      uploadedByUserId: context.principal.userId,
    });
  else
    requireMcp(
      existing.status === "pending" &&
        existing.objectKey === objectKey &&
        existing.sizeBytes === input.sizeBytes,
      "conflict",
      "This upload already has a different file. Start a new import.",
    );
  return {
    mediaAssetId: op.id,
    uploadUrl: await createMediaAssetUploadUrl({
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    }),
  };
}
export async function finishMcpImport(
  context: McpContext,
  operationId: string,
  sourceHost: string | null = null,
) {
  const op = await findMcpOperation({
    workspaceId: context.workspaceId,
    connectionId: context.connection.id,
    userId: context.principal.userId,
    operationId,
  });
  if (op?.status === "succeeded") return publicOperation(op);
  requireMcp(
    op &&
      ["awaiting_upload", "running"].includes(op.status) &&
      op.expiresAt > new Date(),
    "expired",
    "This import is no longer active.",
  );
  let asset = await findMediaAsset({
    workspaceId: context.workspaceId,
    mediaAssetId: op.id,
  });
  requireMcp(
    asset && ["pending", "ready"].includes(asset.status),
    "invalid_file",
    "The upload has not completed.",
  );
  try {
    if (
      op.input.sourceKind === "upload" &&
      asset.status === "pending" &&
      !asset.objectKey.endsWith(".verified")
    ) {
      const oldKey = asset.objectKey;
      const objectKey = await freezeMcpUpload(oldKey);
      const frozen = await setMcpPendingAssetObject(
        context.workspaceId,
        asset.id,
        objectKey,
      );
      requireMcp(frozen, "conflict", "This file is already being verified.");
      asset = frozen;
      await deleteMediaAssetObject(oldKey).catch(() =>
        console.error("MCP staging cleanup deferred", { operationId }),
      );
    }
    if (
      asset.status === "pending" &&
      !(asset.kind === "video" && asset.inspectionTriggerRunId)
    ) {
      const limits = getMediaLibraryEnvironment();
      const inspected = await inspectMediaAsset({
        objectKey: asset.objectKey,
        kind: asset.kind,
      });
      requireMcp(
        inspected.sizeBytes <=
          (asset.kind === "image"
            ? limits.MAX_MEDIA_IMAGE_BYTES
            : limits.MAX_MEDIA_VIDEO_BYTES) &&
          inspected.sizeBytes === asset.sizeBytes,
        "invalid_file",
        "The uploaded file does not match its authorized size.",
      );
      if (asset.kind === "image") {
        const image = sharp(await downloadMediaAssetBytes(asset.objectKey), {
          limitInputPixels: 100_000_000,
          failOn: "error",
        });
        const metadata = await image.metadata();
        const actual =
          metadata.format === "jpeg"
            ? "image/jpeg"
            : `image/${metadata.format}`;
        requireMcp(
          actual === asset.contentType &&
            ["jpeg", "png", "webp", "gif"].includes(metadata.format ?? ""),
          "invalid_file",
          "The file's real format does not match its declared image type.",
        );
        await image.clone().resize(1, 1).raw().toBuffer();
        await markMediaAssetReady({
          workspaceId: context.workspaceId,
          mediaAssetId: asset.id,
          ...inspected,
          durationMilliseconds: null,
        });
      } else {
        await prepareMediaAssetInspection({
          workspaceId: context.workspaceId,
          mediaAssetId: asset.id,
          sizeBytes: inspected.sizeBytes,
        });
        const handle = await tasks.trigger<typeof mediaInspectionTask>(
          "media-inspection",
          {
            kind: "media_asset",
            workspaceId: context.workspaceId,
            mediaAssetId: asset.id,
          },
          { idempotencyKey: `media-inspection:asset:${asset.id}` },
        );
        await attachMediaAssetInspectionRun({
          workspaceId: context.workspaceId,
          mediaAssetId: asset.id,
          triggerRunId: handle.id,
        });
      }
    }
    await addMcpAssetOrigin({
      workspaceId: context.workspaceId,
      operationId: op.id,
      mediaAssetId: asset.id,
      sourceHost,
      attribution: z.string().parse(op.input.attribution),
    });
    if (typeof op.input.title === "string" && op.input.title)
      await updateMediaAssetDetails({
        workspaceId: context.workspaceId,
        mediaAssetId: asset.id,
        title: op.input.title,
        altText: asset.altText,
        tags: asset.tags,
      });
    const row = await updateMcpOperation({
      operationId: op.id,
      workspaceId: context.workspaceId,
      from: ["running", "awaiting_upload"],
      values: {
        status: "succeeded",
        sealedSource: null,
        result: {
          mediaAssetId: asset.id,
          inspectionPending: asset.kind === "video",
          href: "/app/social/library",
        },
      },
    });
    requireMcp(row, "conflict", "This import was cancelled before completion.");
    await recordAuditEvent({
      workspaceId: context.workspaceId,
      actorUserId: context.principal.userId,
      action: "mcp_action_completed",
      targetType: "mcp_operation",
      targetId: op.id,
      metadata: { kind: op.kind },
    });
    return publicOperation(row);
  } catch (error) {
    // Do not destroy media that was committed before a response/database interruption.
    const latest = await findMediaAsset({
      workspaceId: context.workspaceId,
      mediaAssetId: asset.id,
    });
    if (latest?.status === "ready" || latest?.inspectionTriggerRunId)
      throw error;
    await markMediaAssetFailed({
      workspaceId: context.workspaceId,
      mediaAssetId: asset.id,
    });
    await deleteMediaAssetObject(asset.objectKey).catch(() =>
      console.error("MCP import cleanup deferred", { operationId }),
    );
    await updateMcpOperation({
      operationId: op.id,
      workspaceId: context.workspaceId,
      from: ["running", "awaiting_upload"],
      values: {
        status: "failed",
        sealedSource: null,
        error: "The file could not be verified. Supply a fresh supported file.",
      },
    });
    throw error;
  }
}
export async function runMcpImport(workspaceId: string, operationId: string) {
  const op = await findMcpOperation({ workspaceId, operationId });
  if (!op || op.status !== "queued" || op.expiresAt <= new Date()) return;
  const context = await authorizeMcpBrowser(
    op.userId,
    op.connectionId,
    workspaceId,
    "vcstudio:media",
  );
  const claimed = await updateMcpOperation({
    operationId,
    workspaceId,
    from: ["queued"],
    values: { status: "running" },
  });
  if (!claimed) return;
  try {
    if (claimed.input.sourceKind === "mcp_upload") {
      await runMcpChunkImport(context, claimed, () =>
        finishMcpImport(context, claimed.id),
      );
      return;
    }
    requireMcp(
      claimed.sealedSource,
      "invalid_file",
      "This import has no download source.",
    );
    const source = openSecret({
      sealed: claimed.sealedSource,
      key: getPublishingEnvironment().PLATFORM_TOKEN_ENCRYPTION_KEY,
    });
    await withPublicDownload(source, async (response) => {
      const hints: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        mp4: "video/mp4",
        mov: "video/quicktime",
        webm: "video/webm",
      };
      const hint =
        op.input.contentTypeHint ??
        hints[String(op.input.fileName).split(".").pop()?.toLowerCase() ?? ""];
      const type = mediaContentTypeSchema.parse(
        !response.contentType ||
          response.contentType === "application/octet-stream"
          ? hint
          : response.contentType,
      );
      const kind = MEDIA_ASSET_KIND_BY_CONTENT_TYPE[type];
      requireMcp(
        kind !== "audio",
        "unsupported_media",
        "MCP v1 imports images and videos.",
      );
      const limits = getMediaLibraryEnvironment();
      const maximumBytes =
        kind === "image"
          ? limits.MAX_MEDIA_IMAGE_BYTES
          : limits.MAX_MEDIA_VIDEO_BYTES;
      requireMcp(
        !response.contentLength || response.contentLength <= maximumBytes,
        "file_too_large",
        "That file exceeds the upload limit.",
      );
      const objectKey = createMediaLibraryObjectKey({
        workspaceId,
        mediaAssetId: op.id,
        contentType: type,
      });
      await createPendingMediaAsset({
        id: op.id,
        workspaceId,
        kind,
        objectKey,
        contentType: type,
        sizeBytes: 0,
        originalFileName: sanitizeMediaFileName(
          z.string().parse(op.input.fileName),
        ),
        uploadedByUserId: op.userId,
        durationMilliseconds: null,
      });
      const sizeBytes = await streamImportObject({
        objectKey,
        contentType: type,
        maximumBytes,
        body: response.body,
      });
      await setMcpPendingAssetSize(workspaceId, op.id, sizeBytes);
      await authorizeMcpBrowser(
        op.userId,
        op.connectionId,
        workspaceId,
        "vcstudio:media",
      );
      return finishMcpImport(context, op.id, response.sourceHost);
    });
  } catch (error) {
    await updateMcpOperation({
      operationId,
      workspaceId,
      from: ["running"],
      values: {
        status: "failed",
        sealedSource: null,
        error:
          error instanceof McpError
            ? error.message
            : "The file could not be imported. Request a fresh download or use upload.",
      },
    });
  }
}
