import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  begin: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  origin: vi.fn(),
  asset: vi.fn(),
  create: vi.fn(),
  failed: vi.fn(),
  ready: vi.fn(),
  inspect: vi.fn(),
  bytes: vi.fn(),
  remove: vi.fn(),
  trigger: vi.fn(),
  upload: vi.fn(),
  prepare: vi.fn(),
  attach: vi.fn(),
  freeze: vi.fn(),
  setObject: vi.fn(),
  details: vi.fn(),
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  beginMcpOperation: m.begin,
  findMcpOperation: m.find,
  updateMcpOperation: m.update,
  addMcpAssetOrigin: m.origin,
  setMcpPendingAssetSize: vi.fn(),
  setMcpPendingAssetObject: m.setObject,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.asset,
}));
vi.mock("@/db/commands/media-asset-commands", () => ({
  createPendingMediaAsset: m.create,
  markMediaAssetFailed: m.failed,
  markMediaAssetReady: m.ready,
  updateMediaAssetDetails: m.details,
}));
vi.mock("@/db/commands/media-inspection-commands", () => ({
  prepareMediaAssetInspection: m.prepare,
  attachMediaAssetInspectionRun: m.attach,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  inspectMediaAsset: m.inspect,
  downloadMediaAssetBytes: m.bytes,
  deleteMediaAssetObject: m.remove,
  createMediaAssetUploadUrl: m.upload,
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: m.trigger } }));
vi.mock("@/lib/env/server", () => ({
  getMediaLibraryEnvironment: () => ({
    MAX_MEDIA_IMAGE_BYTES: 1000,
    MAX_MEDIA_VIDEO_BYTES: 2000,
  }),
  getPublishingEnvironment: () => ({ PLATFORM_TOKEN_ENCRYPTION_KEY: "test" }),
}));
vi.mock("@/lib/crypto/secret-box", () => ({
  sealSecret: () => "encrypted-download",
  openSecret: () => "https://files.example/asset",
}));
vi.mock("./context", () => ({ authorizeMcpBrowser: vi.fn() }));
vi.mock("./storage-integrity", () => ({ freezeMcpUpload: m.freeze }));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: vi.fn(),
}));
import {
  authorizeMcpUpload,
  finishMcpImport,
  startMcpImport,
} from "./import-service";
import { mcpImportInput } from "@studio/contracts";
import {
  mcpContextFixture,
  mcpIds,
  mcpOperationFixture,
} from "@/lib/test-utils/mcp-fixtures";
const ctx = mcpContextFixture();
const asset = {
  id: mcpIds.operation,
  workspaceId: mcpIds.workspace,
  kind: "image",
  status: "pending",
  objectKey: "workspace/import.png.verified",
  sizeBytes: 100,
  contentType: "image/png",
  altText: "",
  tags: [],
  inspectionTriggerRunId: null,
};
beforeEach(async () => {
  vi.clearAllMocks();
  m.remove.mockResolvedValue(undefined);
  m.find.mockResolvedValue(
    mcpOperationFixture({
      kind: "import_asset",
      status: "awaiting_upload",
      input: { sourceKind: "upload", attribution: "Creator" },
    }),
  );
  m.asset.mockResolvedValue(asset);
  m.inspect.mockResolvedValue({
    sizeBytes: 100,
    contentType: "image/png",
    width: 1,
    height: 1,
  });
  m.bytes.mockResolvedValue(
    await sharp({
      create: { width: 1, height: 1, channels: 3, background: "red" },
    })
      .png()
      .toBuffer(),
  );
  m.update.mockImplementation(async ({ values }) =>
    mcpOperationFixture({ kind: "import_asset", ...values }),
  );
  m.begin.mockImplementation(async (values) => ({
    created: true,
    operation: mcpOperationFixture(values),
  }));
  m.trigger.mockResolvedValue({ id: "worker-run" });
});
describe("asset transfer application service", () => {
  it("keeps temporary native download credentials encrypted and only passes operation IDs to workers", async () => {
    const input = mcpImportInput.parse({
      workspaceId: ctx.workspaceId,
      idempotencyKey: "file-transfer-1",
      source: {
        kind: "file",
        file: {
          file_id: "file-123",
          download_url: "https://files.example/asset?credential=private",
          mime_type: "image/png",
        },
      },
    });
    const result = await startMcpImport(ctx, input);
    expect(JSON.stringify(m.begin.mock.calls[0][0].input)).not.toContain(
      "credential",
    );
    expect(m.begin.mock.calls[0][0].sealedSource).toBe("encrypted-download");
    expect(JSON.stringify(m.trigger.mock.calls)).not.toContain("https:");
    expect(result).not.toHaveProperty("sealedSource");
  });
  it("records unavailable workers as actionable failures and erases temporary credentials", async () => {
    m.trigger.mockRejectedValue(new Error("unavailable"));
    const input = mcpImportInput.parse({
      workspaceId: ctx.workspaceId,
      idempotencyKey: "worker-failure",
      source: {
        kind: "url",
        url: "https://files.example/image",
        fileName: "file.png",
      },
    });
    await expect(startMcpImport(ctx, input)).rejects.toThrow("upload handoff");
    expect(m.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          status: "failed",
          sealedSource: null,
        }),
      }),
    );
  });
  it("validates real image content, records attribution and makes completion retries idempotent", async () => {
    const result = await finishMcpImport(ctx, mcpIds.operation);
    expect(result.status).toBe("succeeded");
    expect(m.ready).toHaveBeenCalledTimes(1);
    expect(m.origin).toHaveBeenCalledWith(
      expect.objectContaining({ attribution: "Creator" }),
    );
    m.find.mockResolvedValue(
      mcpOperationFixture({
        kind: "import_asset",
        status: "succeeded",
        result: { mediaAssetId: asset.id },
      }),
    );
    await finishMcpImport(ctx, mcpIds.operation);
    expect(m.ready).toHaveBeenCalledTimes(1);
  });
  it("rejects disguised and oversized image uploads without making a usable asset", async () => {
    m.bytes.mockResolvedValue(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
      ),
    );
    await expect(finishMcpImport(ctx, mcpIds.operation)).rejects.toThrow(
      "real format",
    );
    expect(m.ready).not.toHaveBeenCalled();
    expect(m.failed).toHaveBeenCalled();
    m.inspect.mockResolvedValue({ sizeBytes: 1001 });
    await expect(finishMcpImport(ctx, mcpIds.operation)).rejects.toThrow(
      "authorized size",
    );
  });
  it("freezes a browser upload before validating the accepted copy", async () => {
    m.asset.mockResolvedValue({ ...asset, objectKey: "workspace/import.png" });
    m.freeze.mockResolvedValue(asset.objectKey);
    m.setObject.mockResolvedValue(asset);
    await finishMcpImport(ctx, mcpIds.operation);
    expect(m.setObject).toHaveBeenCalledWith(
      ctx.workspaceId,
      asset.id,
      asset.objectKey,
    );
    expect(m.inspect).toHaveBeenCalledWith({
      objectKey: asset.objectKey,
      kind: "image",
    });
  });
  it("sends video to inspection without marking it ready or auto-approving it", async () => {
    m.asset.mockResolvedValue({
      ...asset,
      kind: "video",
      contentType: "video/mp4",
    });
    const result = await finishMcpImport(ctx, mcpIds.operation);
    expect(result.result?.inspectionPending).toBe(true);
    expect(m.prepare).toHaveBeenCalled();
    expect(m.ready).not.toHaveBeenCalled();
  });
  it("rejects expired upload handoffs before creating storage credentials", async () => {
    m.find.mockResolvedValue(
      mcpOperationFixture({
        kind: "import_asset",
        status: "awaiting_upload",
        expiresAt: new Date(0),
      }),
    );
    await expect(
      authorizeMcpUpload(ctx, mcpIds.operation, {
        fileName: "file.png",
        contentType: "image/png",
        sizeBytes: 100,
      }),
    ).rejects.toThrow("expired");
    expect(m.upload).not.toHaveBeenCalled();
  });
});
