import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  context: vi.fn(),
  reconcile: vi.fn(),
  find: vi.fn(),
  claim: vi.fn(),
  attach: vi.fn(),
  trigger: vi.fn(),
  sign: vi.fn(),
  audit: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: m.trigger } }));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: m.context,
}));
vi.mock("@/lib/media/reconcile-media-inspection", () => ({
  reconcileMediaInspection: m.reconcile,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.find,
}));
vi.mock("@/db/commands/media-inspection-commands", () => ({
  claimMediaAssetInspectionRetry: m.claim,
  attachMediaAssetInspectionRun: m.attach,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  createMediaAssetDownloadUrl: m.sign,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: m.audit,
}));
vi.mock("@/lib/rate-limit/enforce-rate-limit", () => ({
  enforceRateLimit: m.rate,
}));
import {
  checkLibraryInspections,
  retryLibraryInspection,
} from "./library-inspection-service";
const id = "11111111-1111-4111-8111-111111111111";
const asset = {
  id,
  workspaceId: "authorized",
  kind: "video",
  status: "failed",
  inspectionStatus: "failed",
  inspectionTriggerRunId: "run-old",
  inspectionError: "Verification stopped.",
  inspectionWarnings: [],
  deletedAt: null,
  objectKey: "private-key",
  originalFileName: "video.mp4",
  title: "Video",
  altText: "",
  tags: [],
  sizeBytes: 100,
  contentType: "video/mp4",
  createdAt: new Date(),
  updatedAt: new Date(),
  width: null,
  height: null,
  verifiedMetadata: null,
  durationMilliseconds: 1000,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.context.mockResolvedValue({
    activeMembership: { workspaceId: "authorized", role: "owner" },
    user: { id: "owner" },
  });
  m.reconcile.mockResolvedValue(asset);
  m.find.mockResolvedValue({
    ...asset,
    status: "pending",
    inspectionStatus: "pending",
  });
  m.claim.mockResolvedValue({
    ...asset,
    status: "pending",
    inspectionStatus: "pending",
  });
  m.trigger.mockResolvedValue({ id: "run-new" });
  m.sign.mockResolvedValue("signed-preview");
});
describe("library inspection actions", () => {
  it.each(["viewer", "missing"])(
    "blocks %s before reading or dispatching anything",
    async (role) => {
      m.context.mockResolvedValue(
        role === "missing"
          ? null
          : { activeMembership: { workspaceId: "authorized", role } },
      );
      expect((await checkLibraryInspections([id])).ok).toBe(false);
      expect((await retryLibraryInspection(id)).ok).toBe(false);
      expect(m.reconcile).not.toHaveBeenCalled();
      expect(m.trigger).not.toHaveBeenCalled();
    },
  );
  it("bounds and validates IDs before workspace reads", async () => {
    expect(
      (await checkLibraryInspections(Array.from({ length: 13 }, () => id))).ok,
    ).toBe(false);
    expect((await retryLibraryInspection("bad")).ok).toBe(false);
    expect(m.reconcile).not.toHaveBeenCalled();
  });
  it("uses the server workspace and never signs pending or failed files", async () => {
    const result = await checkLibraryInspections([id, id]);
    expect(result).toMatchObject({
      ok: true,
      assets: [{ id, inspectionFailed: true, previewUrl: "" }],
    });
    expect(m.reconcile).toHaveBeenCalledExactlyOnceWith({
      workspaceId: "authorized",
      mediaAssetId: id,
    });
    expect(m.sign).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private-key");
  });
  it("reuses the original and derives a retry identity from the previous run", async () => {
    expect((await retryLibraryInspection(id)).ok).toBe(true);
    expect(m.claim).toHaveBeenCalledWith({
      workspaceId: "authorized",
      mediaAssetId: id,
      previousRunId: "run-old",
    });
    expect(m.trigger).toHaveBeenCalledWith(
      "media-inspection",
      { kind: "media_asset", workspaceId: "authorized", mediaAssetId: id },
      { idempotencyKey: `media-inspection:retry:${id}:run-old` },
    );
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          operation: "retry_video_verification",
          reusedOriginal: true,
        },
      }),
    );
  });
  it("rejects a competing retry claim before creating a second run", async () => {
    m.claim.mockResolvedValue(null);
    expect((await retryLibraryInspection(id)).ok).toBe(false);
    expect(m.trigger).not.toHaveBeenCalled();
  });
  it("does not restart active or already-ready video inspection", async () => {
    m.reconcile.mockResolvedValue({
      ...asset,
      status: "ready",
      inspectionStatus: "succeeded",
    });
    expect(await retryLibraryInspection(id)).toMatchObject({
      ok: true,
      assets: [{ previewUrl: "signed-preview" }],
    });
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.trigger).not.toHaveBeenCalled();
  });
  it("keeps a queued original intact after ambiguous dispatch failure", async () => {
    m.trigger.mockRejectedValue(new Error("private internal error"));
    const result = await retryLibraryInspection(id);
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("request may still be processing"),
    });
    expect(JSON.stringify(result)).not.toContain("private internal error");
  });
});
