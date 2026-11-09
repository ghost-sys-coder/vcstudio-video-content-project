import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  create: vi.fn(),
  size: vi.fn(),
  clean: vi.fn(),
  remove: vi.fn(),
  authorize: vi.fn(),
  stream: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/db/commands/media-asset-commands", () => ({
  createPendingMediaAsset: m.create,
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  setMcpPendingAssetSize: m.size,
  markMcpUploadChunksCleaned: m.clean,
}));
vi.mock("./context", () => ({ authorizeMcpBrowser: m.authorize }));
vi.mock("./chunk-upload-storage", () => ({
  readMcpChunks: m.read,
  removeMcpChunks: m.remove,
}));
vi.mock("./import-storage", () => ({ streamImportObject: m.stream }));
import { runMcpChunkImport } from "./chunk-upload-worker";
import {
  mcpContextFixture,
  mcpOperationFixture,
} from "@/lib/test-utils/mcp-fixtures";
const ctx = mcpContextFixture(),
  op = mcpOperationFixture({
    kind: "import_asset",
    status: "running",
    input: {
      sourceKind: "mcp_upload",
      fileName: "clip.mp4",
      contentType: "video/mp4",
      sizeBytes: 3,
      fileFingerprint: "a".repeat(64),
      title: "Clip",
      attribution: "Creator",
    },
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.stream.mockResolvedValue(3);
  m.read.mockReturnValue(
    (async function* () {
      yield Buffer.from("abc");
    })(),
  );
});
describe("on-demand chunk assembly uses the existing media pipeline", () => {
  it("creates a pending private asset and checks current authority before inspection/completion", async () => {
    const finish = vi.fn().mockResolvedValue({ status: "succeeded" });
    await runMcpChunkImport(ctx, op, finish);
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: op.id,
        workspaceId: ctx.workspaceId,
        kind: "video",
        sizeBytes: 0,
        contentType: "video/mp4",
      }),
    );
    expect(m.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        maximumBytes: 3,
        objectKey: expect.stringContaining(ctx.workspaceId),
      }),
    );
    expect(m.size).toHaveBeenCalledWith(ctx.workspaceId, op.id, 3);
    expect(m.authorize).toHaveBeenCalledWith(
      op.userId,
      op.connectionId,
      ctx.workspaceId,
      "vcstudio:media",
    );
    expect(m.authorize.mock.invocationCallOrder[0]).toBeLessThan(
      finish.mock.invocationCallOrder[0],
    );
    expect(m.remove).toHaveBeenCalledWith(ctx.workspaceId, op.id);
    expect(m.clean).not.toHaveBeenCalled();
  });
  it("cannot finish after revocation or failed integrity/assembly", async () => {
    const finish = vi.fn();
    m.authorize.mockRejectedValue(new Error("revoked"));
    await expect(runMcpChunkImport(ctx, op, finish)).rejects.toThrow("revoked");
    expect(finish).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
    m.stream.mockRejectedValue(new Error("invalid bytes"));
    await expect(runMcpChunkImport(ctx, op, finish)).rejects.toThrow(
      "invalid bytes",
    );
    expect(finish).not.toHaveBeenCalled();
  });
  it("does not turn a completed import into failure if scratch cleanup must be deferred", async () => {
    m.remove.mockRejectedValue(new Error("storage offline"));
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const finish = vi.fn().mockResolvedValue({});
    await expect(runMcpChunkImport(ctx, op, finish)).resolves.toBeUndefined();
    expect(finish).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });
});
