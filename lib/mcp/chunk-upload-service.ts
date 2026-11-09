import "server-only";
import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import {
  mcpUploadMetadata,
  mcpUploadKey,
  MCP_UPLOAD_CHUNK_BYTES,
  MCP_UPLOAD_MAX_BYTES,
  type McpUploadSession,
} from "@studio/contracts/mcp-upload";
import {
  beginMcpOperation,
  findMcpOperation,
  updateMcpOperation,
  type McpOperation,
} from "@/db/repositories/mcp.repository";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { getMediaLibraryEnvironment } from "@/lib/env/server";
import { sanitizeMediaFileName } from "@/lib/schemas/media-asset";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import type { mcpMediaImportTask } from "@/trigger/mcp-media-import";
import type { McpContext } from "./context";
import { McpError, requireMcp } from "./errors";
import { fingerprint } from "./fingerprint";
import {
  listMcpChunks,
  removeMcpChunks,
  removeMcpChunk,
  storeMcpChunk,
} from "./chunk-upload-storage";
import type { z } from "zod";
import type {
  mcpUploadStartInput,
  mcpUploadChunkInput,
  mcpUploadMutation,
} from "@studio/contracts/mcp-upload";

export function mcpUploadLimits() {
  const env = getMediaLibraryEnvironment();
  return {
    maxImageBytes: Math.min(env.MAX_MEDIA_IMAGE_BYTES, MCP_UPLOAD_MAX_BYTES),
    maxVideoBytes: Math.min(env.MAX_MEDIA_VIDEO_BYTES, MCP_UPLOAD_MAX_BYTES),
    chunkBytes: MCP_UPLOAD_CHUNK_BYTES,
  };
}
export async function findOwnedMcpUpload(ctx: McpContext, uploadId: string) {
  const op = await findMcpOperation({
    workspaceId: ctx.workspaceId,
    operationId: uploadId,
    connectionId: ctx.connection.id,
    userId: ctx.principal.userId,
  });
  requireMcp(
    op?.kind === "import_asset" && op.input.sourceKind === "mcp_upload",
    "not_found",
    "That upload is unavailable for this connection and workspace.",
  );
  return op;
}
export async function mcpUploadSession(
  ctx: McpContext,
  op: McpOperation,
  empty = false,
): Promise<McpUploadSession> {
  const meta = mcpUploadMetadata.parse(op.input),
    count = Math.ceil(meta.sizeBytes / MCP_UPLOAD_CHUNK_BYTES);
  const transferred = ["queued", "running", "succeeded"].includes(op.status);
  const chunks =
    empty || transferred || op.result?.uploadChunksCleaned === true
      ? []
      : await listMcpChunks(ctx.workspaceId, op.id);
  const asset =
    op.status === "succeeded"
      ? await findMediaAsset({
          workspaceId: ctx.workspaceId,
          mediaAssetId: op.id,
        })
      : null;
  return {
    uploadId: op.id,
    workspaceId: ctx.workspaceId,
    status:
      op.expiresAt <= new Date() &&
      ["awaiting_upload", "queued", "running"].includes(op.status)
        ? "expired"
        : op.status,
    expiresAt: op.expiresAt.toISOString(),
    fileName: meta.fileName,
    sizeBytes: meta.sizeBytes,
    fileFingerprint: meta.fileFingerprint,
    chunkBytes: MCP_UPLOAD_CHUNK_BYTES,
    chunkCount: count,
    receivedIndices: transferred
      ? Array.from({ length: count }, (_, i) => i)
      : chunks.map((c) => c.index),
    receivedBytes: transferred
      ? meta.sizeBytes
      : chunks.reduce((sum, c) => sum + c.size, 0),
    mediaAssetId: asset?.id ?? null,
    mediaStatus: asset?.status ?? null,
    inspectionStatus: asset?.inspectionStatus ?? null,
    error: op.error ?? asset?.inspectionError ?? null,
  };
}
export async function startMcpChunkUpload(
  ctx: McpContext,
  input: z.infer<typeof mcpUploadStartInput>,
) {
  const metadata = mcpUploadMetadata.parse({
      ...input,
      fileName: sanitizeMediaFileName(input.fileName),
    }),
    limits = mcpUploadLimits();
  requireMcp(
    metadata.sizeBytes <=
      (metadata.contentType.startsWith("image/")
        ? limits.maxImageBytes
        : limits.maxVideoBytes),
    "file_too_large",
    "That file exceeds this workspace's media upload limit.",
  );
  const started = await beginMcpOperation({
    workspaceId: ctx.workspaceId,
    connectionId: ctx.connection.id,
    userId: ctx.principal.userId,
    idempotencyKey: input.idempotencyKey,
    kind: "import_asset",
    fingerprint: fingerprint({ kind: "mcp_upload", ...metadata }),
    input: {
      ...metadata,
      sourceKind: "mcp_upload",
      chunkBytes: MCP_UPLOAD_CHUNK_BYTES,
    },
    status: "awaiting_upload",
    expiresAt: new Date(Date.now() + 3600_000),
  });
  requireMcp(
    started.operation.fingerprint ===
      fingerprint({ kind: "mcp_upload", ...metadata }),
    "conflict",
    "That idempotency key belongs to a different file or action.",
  );
  return mcpUploadSession(ctx, started.operation, started.created);
}
export async function appendMcpUpload(
  ctx: McpContext,
  input: z.infer<typeof mcpUploadChunkInput>,
) {
  const op = await findOwnedMcpUpload(ctx, input.uploadId),
    meta = mcpUploadMetadata.parse(op.input);
  requireMcp(
    op.expiresAt > new Date() && op.status === "awaiting_upload",
    "expired",
    "This upload is no longer accepting chunks. Inspect its status before retrying.",
  );
  requireMcp(
    input.idempotencyKey === mcpUploadKey(op.id, input.index, input.sha256),
    "conflict",
    "Use the upload ID, chunk index and SHA-256 digest in this chunk's idempotency key.",
  );
  const bytes = Buffer.from(input.dataBase64, "base64"),
    expected = Math.min(
      MCP_UPLOAD_CHUNK_BYTES,
      meta.sizeBytes - input.index * MCP_UPLOAD_CHUNK_BYTES,
    );
  requireMcp(
    expected > 0 &&
      bytes.length === expected &&
      bytes.toString("base64") === input.dataBase64,
    "invalid_file",
    "The chunk index, encoding or byte length does not match this upload.",
  );
  requireMcp(
    createHash("sha256").update(bytes).digest("hex") === input.sha256,
    "invalid_file",
    "The chunk failed its SHA-256 check.",
  );
  const stored = await storeMcpChunk({
    ...input,
    workspaceId: ctx.workspaceId,
    bytes,
  });
  const current = await findOwnedMcpUpload(ctx, op.id);
  if (
    ["cancelled", "expired", "failed", "succeeded"].includes(current.status)
  ) {
    try {
      await removeMcpChunk(ctx.workspaceId, op.id, input.index);
    } catch {
      await updateMcpOperation({
        workspaceId: ctx.workspaceId,
        operationId: op.id,
        from: ["cancelled", "expired", "failed", "succeeded"],
        values: { result: { ...current.result, uploadChunksCleaned: false } },
      });
    }
    requireMcp(
      current.status === "succeeded",
      "expired",
      "This upload was cancelled or expired while the chunk was in flight.",
    );
  }
  return {
    uploadId: op.id,
    index: input.index,
    sizeBytes: bytes.length,
    sha256: input.sha256,
    ...stored,
  };
}
export async function completeMcpUpload(
  ctx: McpContext,
  input: z.infer<typeof mcpUploadMutation>,
) {
  let op = await findOwnedMcpUpload(ctx, input.uploadId);
  requireMcp(
    input.idempotencyKey === mcpUploadKey(op.id, "complete"),
    "conflict",
    "Use this upload's completion idempotency key.",
  );
  if (["running", "succeeded"].includes(op.status))
    return mcpUploadSession(ctx, op);
  requireMcp(
    op.expiresAt > new Date() &&
      ["awaiting_upload", "queued"].includes(op.status),
    "expired",
    "This upload cannot be completed. Inspect its status or start a fresh upload.",
  );
  if (op.status === "awaiting_upload") {
    const meta = mcpUploadMetadata.parse(op.input),
      chunks = await listMcpChunks(ctx.workspaceId, op.id),
      count = Math.ceil(meta.sizeBytes / MCP_UPLOAD_CHUNK_BYTES);
    requireMcp(
      chunks.length === count &&
        chunks.every(
          (part, index) =>
            part.index === index &&
            part.size ===
              Math.min(
                MCP_UPLOAD_CHUNK_BYTES,
                meta.sizeBytes - index * MCP_UPLOAD_CHUNK_BYTES,
              ),
        ),
      "incomplete_upload",
      "Some chunks are missing or have the wrong size. Resume this upload before completing it.",
    );
    const queued = await updateMcpOperation({
      workspaceId: ctx.workspaceId,
      operationId: op.id,
      from: ["awaiting_upload"],
      values: { status: "queued", error: null },
    });
    if (!queued) {
      op = await findOwnedMcpUpload(ctx, op.id);
      requireMcp(
        ["queued", "running", "succeeded"].includes(op.status),
        "conflict",
        "This upload changed. Inspect its status.",
      );
      if (op.status !== "queued") return mcpUploadSession(ctx, op);
    } else op = queued;
  }
  try {
    // Fixed outbox identity: retrying an ambiguous dispatch cannot duplicate import.
    const handle = await tasks.trigger<typeof mcpMediaImportTask>(
      "mcp-media-import",
      { workspaceId: ctx.workspaceId, operationId: op.id },
      { idempotencyKey: `mcp-import:${op.id}` },
    );
    await updateMcpOperation({
      workspaceId: ctx.workspaceId,
      operationId: op.id,
      from: ["queued"],
      values: { triggerRunId: handle.id },
    });
  } catch {
    throw new McpError(
      "worker_unavailable",
      "The upload is saved, but import dispatch was not confirmed. Retry completion with the same key; do not upload the bytes again.",
    );
  }
  return mcpUploadSession(ctx, await findOwnedMcpUpload(ctx, op.id));
}
export async function cancelMcpUpload(
  ctx: McpContext,
  input: z.infer<typeof mcpUploadMutation>,
) {
  const op = await findOwnedMcpUpload(ctx, input.uploadId);
  requireMcp(
    input.idempotencyKey === mcpUploadKey(op.id, "cancel"),
    "conflict",
    "Use this upload's cancellation idempotency key.",
  );
  if (op.status !== "cancelled") {
    const changed = await updateMcpOperation({
      workspaceId: ctx.workspaceId,
      operationId: op.id,
      from: ["awaiting_upload", "queued"],
      values: { status: "cancelled", sealedSource: null },
    });
    requireMcp(
      changed,
      "conflict",
      "The upload is already processing or finished. Cancellation cannot delete a library asset.",
    );
  }
  try {
    await removeMcpChunks(ctx.workspaceId, op.id);
    // Keep the session eligible for the later grace-period cleanup: a timed-out
    // conditional PUT can still commit after its caller lost the response.
  } catch {
    console.error("MCP chunk cleanup deferred", { uploadId: op.id });
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorUserId: ctx.principal.userId,
    action: "mcp_action_completed",
    targetType: "mcp_operation",
    targetId: op.id,
    metadata: { kind: "cancel_media_upload", libraryAssetDeleted: false },
  });
  return mcpUploadSession(ctx, await findOwnedMcpUpload(ctx, op.id));
}
