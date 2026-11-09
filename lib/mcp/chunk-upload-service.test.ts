import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: vi.fn(),
}));
const m = vi.hoisted(() => ({
  begin: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  clean: vi.fn(),
  asset: vi.fn(),
  list: vi.fn(),
  store: vi.fn(),
  remove: vi.fn(),
  removeOne: vi.fn(),
  trigger: vi.fn(),
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  beginMcpOperation: m.begin,
  findMcpOperation: m.find,
  updateMcpOperation: m.update,
  markMcpUploadChunksCleaned: m.clean,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.asset,
}));
vi.mock("./chunk-upload-storage", () => ({
  listMcpChunks: m.list,
  storeMcpChunk: m.store,
  removeMcpChunks: m.remove,
  removeMcpChunk: m.removeOne,
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: m.trigger } }));
vi.mock("@/lib/env/server", () => ({
  getMediaLibraryEnvironment: () => ({
    MAX_MEDIA_IMAGE_BYTES: 1000,
    MAX_MEDIA_VIDEO_BYTES: 5_000_000,
  }),
}));
import {
  startMcpChunkUpload,
  appendMcpUpload,
  completeMcpUpload,
  cancelMcpUpload,
  findOwnedMcpUpload,
  mcpUploadSession,
} from "./chunk-upload-service";
import {
  mcpUploadChunkInput,
  mcpUploadKey,
  MCP_UPLOAD_CHUNK_BYTES,
} from "@studio/contracts/mcp-upload";
import {
  mcpContextFixture,
  mcpOperationFixture,
  mcpIds,
} from "@/lib/test-utils/mcp-fixtures";
import { fingerprint } from "./fingerprint";
const ctx = mcpContextFixture();
const metadata = {
  fileName: "test.mp4",
  contentType: "video/mp4" as const,
  sizeBytes: 3,
  fileFingerprint: "a".repeat(64),
  title: "Original video",
  attribution: "Creator",
};
const input = {
  workspaceId: ctx.workspaceId,
  idempotencyKey: "begin-video-upload",
  ...metadata,
};
let op = mcpOperationFixture();
beforeEach(() => {
  vi.resetAllMocks();
  op = mcpOperationFixture({
    kind: "import_asset",
    status: "awaiting_upload",
    input: { ...metadata, sourceKind: "mcp_upload" },
    fingerprint: fingerprint({ kind: "mcp_upload", ...metadata }),
    result: null,
  });
  m.find.mockImplementation(async () => op);
  m.begin.mockImplementation(async () => ({ created: true, operation: op }));
  m.update.mockImplementation(
    async ({
      from,
      values,
    }: {
      from?: string[];
      values: Partial<typeof op>;
    }) => {
      if (from && !from.includes(op.status)) return null;
      op = { ...op, ...values };
      return op;
    },
  );
  m.list.mockResolvedValue([{ index: 0, size: 3, key: "chunk-0000" }]);
  m.store.mockResolvedValue({ reused: false });
  m.trigger.mockResolvedValue({ id: "import-run" });
  m.asset.mockResolvedValue(null);
});
const completion = () => ({
  workspaceId: ctx.workspaceId,
  uploadId: op.id,
  idempotencyKey: mcpUploadKey(op.id, "complete"),
});
function part(bytes = Buffer.from("abc")) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    workspaceId: ctx.workspaceId,
    uploadId: op.id,
    index: 0,
    sha256,
    dataBase64: bytes.toString("base64"),
    idempotencyKey: mcpUploadKey(op.id, 0, sha256),
  };
}
describe("owned browser-free upload sessions", () => {
  it("creates only metadata, no binary/database payload, media asset or worker", async () => {
    expect(await startMcpChunkUpload(ctx, input)).toMatchObject({
      uploadId: op.id,
      status: "awaiting_upload",
      chunkCount: 1,
      receivedIndices: [],
    });
    expect(m.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: ctx.workspaceId,
        userId: ctx.principal.userId,
        connectionId: ctx.connection.id,
        kind: "import_asset",
        input: {
          ...metadata,
          sourceKind: "mcp_upload",
          chunkBytes: MCP_UPLOAD_CHUNK_BYTES,
        },
      }),
    );
    expect(m.trigger).not.toHaveBeenCalled();
    expect(m.list).not.toHaveBeenCalled();
  });
  it("rejects reused start keys with changed files and files exceeding configured limits", async () => {
    await expect(
      startMcpChunkUpload(ctx, { ...input, sizeBytes: 4 }),
    ).rejects.toThrow("different file");
    await expect(
      startMcpChunkUpload(ctx, { ...input, sizeBytes: 5_000_001 }),
    ).rejects.toThrow("upload limit");
  });
  it("scopes every upload lookup by user, connection and workspace; missing/foreign IDs fail", async () => {
    await findOwnedMcpUpload(ctx, op.id);
    expect(m.find).toHaveBeenCalledWith({
      workspaceId: ctx.workspaceId,
      operationId: op.id,
      connectionId: ctx.connection.id,
      userId: ctx.principal.userId,
    });
    m.find.mockResolvedValue(null);
    await expect(appendMcpUpload(ctx, part())).rejects.toThrow("unavailable");
    expect(m.store).not.toHaveBeenCalled();
  });
  it("accepts the exact original bytes and reuses an identical retry", async () => {
    expect(await appendMcpUpload(ctx, part())).toMatchObject({
      index: 0,
      sizeBytes: 3,
      reused: false,
    });
    expect(m.store).toHaveBeenCalledWith(
      expect.objectContaining({
        bytes: Buffer.from("abc"),
        workspaceId: ctx.workspaceId,
      }),
    );
    m.store.mockResolvedValue({ reused: true });
    expect(await appendMcpUpload(ctx, part())).toMatchObject({ reused: true });
  });
  it.each(["checksum", "index", "size", "encoding", "key"])(
    "rejects invalid %s before storing bytes",
    async (kind) => {
      const value = part();
      if (kind === "checksum") value.sha256 = "f".repeat(64);
      if (kind === "index") value.index = 2;
      if (kind === "size") value.dataBase64 = "YQ==";
      if (kind === "encoding") value.dataBase64 = "YWJj\n";
      if (kind === "key") value.idempotencyKey = "wrong-key";
      if (kind !== "key")
        value.idempotencyKey = mcpUploadKey(op.id, value.index, value.sha256);
      await expect(appendMcpUpload(ctx, value)).rejects.toThrow();
      expect(m.store).not.toHaveBeenCalled();
    },
  );
  it("validates bounded base64 without rejecting a full allowed chunk", () => {
    const bytes = Buffer.alloc(MCP_UPLOAD_CHUNK_BYTES);
    expect(mcpUploadChunkInput.safeParse(part(bytes)).success).toBe(true);
    expect(
      mcpUploadChunkInput.safeParse({
        ...part(),
        dataBase64: "a".repeat(1024 * 1024),
      }).success,
    ).toBe(false);
    expect(
      mcpUploadChunkInput.safeParse({ ...part(), dataBase64: "!!!=" }).success,
    ).toBe(false);
  });
  it("does not accept chunks after expiry, completion or revocation cancellation", async () => {
    for (const status of [
      "queued",
      "cancelled",
      "expired",
      "succeeded",
    ] as const) {
      op = { ...op, status };
      await expect(appendMcpUpload(ctx, part())).rejects.toThrow(
        "no longer accepting",
      );
    }
    op = { ...op, status: "awaiting_upload", expiresAt: new Date(0) };
    await expect(appendMcpUpload(ctx, part())).rejects.toThrow();
    expect(m.store).not.toHaveBeenCalled();
  });
  it("cleans a late in-flight chunk if cancellation wins the race", async () => {
    m.store.mockImplementation(async () => {
      op = { ...op, status: "cancelled" };
      return { reused: false };
    });
    await expect(appendMcpUpload(ctx, part())).rejects.toThrow("cancelled");
    expect(m.removeOne).toHaveBeenCalledWith(ctx.workspaceId, op.id, 0);
  });
  it("refuses incomplete/mis-sized parts before queueing", async () => {
    for (const parts of [
      [],
      [{ index: 1, size: 3 }],
      [{ index: 0, size: 2 }],
    ]) {
      m.list.mockResolvedValue(parts);
      await expect(completeMcpUpload(ctx, completion())).rejects.toThrow(
        "missing",
      );
    }
    expect(m.trigger).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("queues only the durable ID and safely reuses completion/dispatch retries", async () => {
    expect(await completeMcpUpload(ctx, completion())).toMatchObject({
      status: "queued",
      receivedBytes: 3,
    });
    await completeMcpUpload(ctx, completion());
    expect(m.trigger).toHaveBeenCalledTimes(2);
    expect(m.trigger).toHaveBeenCalledWith(
      "mcp-media-import",
      { workspaceId: ctx.workspaceId, operationId: op.id },
      { idempotencyKey: `mcp-import:${op.id}` },
    );
    expect(m.list).toHaveBeenCalledTimes(1);
    op = { ...op, status: "succeeded" };
    m.asset.mockResolvedValue({
      id: op.id,
      status: "ready",
      inspectionStatus: "succeeded",
      inspectionError: null,
    });
    expect(await completeMcpUpload(ctx, completion())).toMatchObject({
      mediaStatus: "ready",
    });
    expect(m.trigger).toHaveBeenCalledTimes(2);
  });
  it("preserves queued chunks after an unavailable/ambiguous worker dispatch", async () => {
    m.trigger.mockRejectedValue(new Error("unavailable"));
    await expect(completeMcpUpload(ctx, completion())).rejects.toThrow(
      "do not upload the bytes again",
    );
    expect(op.status).toBe("queued");
    expect(m.remove).not.toHaveBeenCalled();
    m.trigger.mockResolvedValue({ id: "reused-run" });
    expect(await completeMcpUpload(ctx, completion())).toMatchObject({
      status: "queued",
    });
  });
  it("cancels only scratch uploads; cannot delete processing or ready assets", async () => {
    const args = {
      workspaceId: ctx.workspaceId,
      uploadId: op.id,
      idempotencyKey: mcpUploadKey(op.id, "cancel"),
    };
    expect(await cancelMcpUpload(ctx, args)).toMatchObject({
      status: "cancelled",
    });
    expect(m.clean).not.toHaveBeenCalled();
    await cancelMcpUpload(ctx, args);
    op = { ...op, status: "running" };
    await expect(cancelMcpUpload(ctx, args)).rejects.toThrow("cannot delete");
    op = { ...op, status: "succeeded" };
    await expect(cancelMcpUpload(ctx, args)).rejects.toThrow("cannot delete");
  });
  it("exposes current inspection status instead of assuming transfer means ready", async () => {
    op = { ...op, status: "succeeded" };
    m.asset.mockResolvedValue({
      id: op.id,
      status: "pending",
      inspectionStatus: "running",
      inspectionError: null,
    });
    expect(await mcpUploadSession(ctx, op)).toMatchObject({
      mediaStatus: "pending",
      inspectionStatus: "running",
    });
    m.asset.mockResolvedValue({
      id: mcpIds.operation,
      status: "failed",
      inspectionStatus: "failed",
      inspectionError: "Invalid codec",
    });
    expect(await mcpUploadSession(ctx, op)).toMatchObject({
      mediaStatus: "failed",
      error: "Invalid codec",
    });
  });
});
