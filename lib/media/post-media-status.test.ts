import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  context: vi.fn(),
  find: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: m.context,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.find,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  createMediaAssetDownloadUrl: m.sign,
}));
vi.mock("@/lib/media/load-media-library", () => ({
  loadMediaLibraryPage: vi.fn(),
}));
import { getPostMediaStatusAction } from "@/app/(authenticated)/app/social/library-actions";
const id = "11111111-1111-4111-8111-111111111111",
  workspace = "22222222-2222-4222-8222-222222222222";
const asset = {
  id,
  workspaceId: workspace,
  kind: "video",
  status: "pending",
  inspectionStatus: "pending",
  deletedAt: null,
  objectKey: "private-key",
  title: "Video",
  altText: "",
  tags: [],
  contentType: "video/mp4",
  sizeBytes: 10,
  width: null,
  height: null,
  durationMilliseconds: 5000,
  verifiedMetadata: null,
  inspectionWarnings: [],
  originalFileName: "video.mp4",
  createdAt: new Date("2026-11-05T00:00:00Z"),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.context.mockResolvedValue({
    activeMembership: { workspaceId: workspace, role: "owner" },
  });
  m.find.mockResolvedValue(asset);
  m.sign.mockResolvedValue("signed-preview");
});
describe("on-demand post media status", () => {
  it("rejects invalid IDs and unauthorized users before reading assets", async () => {
    expect((await getPostMediaStatusAction("bad-id")).ok).toBe(false);
    m.context.mockResolvedValue({
      activeMembership: { workspaceId: workspace, role: "viewer" },
    });
    expect((await getPostMediaStatusAction(id)).ok).toBe(false);
    expect(m.find).not.toHaveBeenCalled();
  });
  it("scopes reads and keeps pending video private without signing a preview", async () => {
    const result = await getPostMediaStatusAction(id);
    expect(m.find).toHaveBeenCalledWith({
      workspaceId: workspace,
      mediaAssetId: id,
    });
    expect(result).toMatchObject({
      ok: true,
      asset: { id, inspectionPending: true, previewUrl: "" },
    });
    expect(JSON.stringify(result)).not.toContain("private-key");
    expect(m.sign).not.toHaveBeenCalled();
  });
  it("returns verified media with a signed preview and flags failed inspection", async () => {
    m.find.mockResolvedValueOnce({
      ...asset,
      status: "ready",
      inspectionStatus: "succeeded",
    });
    expect(await getPostMediaStatusAction(id)).toMatchObject({
      ok: true,
      asset: { id, previewUrl: "signed-preview" },
    });
    m.find.mockResolvedValueOnce({
      ...asset,
      status: "failed",
      inspectionStatus: "failed",
    });
    expect(await getPostMediaStatusAction(id)).toMatchObject({
      ok: true,
      asset: { id, inspectionFailed: true, previewUrl: "" },
    });
  });
  it("never signs or treats a ready-row video as usable while its inspection is pending or failed", async () => {
    m.find.mockResolvedValueOnce({
      ...asset,
      status: "ready",
      inspectionStatus: "running",
    });
    expect(await getPostMediaStatusAction(id)).toMatchObject({
      ok: true,
      asset: { inspectionPending: true, previewUrl: "" },
    });
    m.find.mockResolvedValueOnce({
      ...asset,
      status: "ready",
      inspectionStatus: "failed",
    });
    expect(await getPostMediaStatusAction(id)).toMatchObject({
      ok: true,
      asset: { inspectionFailed: true, previewUrl: "" },
    });
    expect(m.sign).not.toHaveBeenCalled();
  });
  it("does not present a missing, deleted or unverified upload as ready", async () => {
    for (const value of [
      null,
      { ...asset, deletedAt: new Date() },
      { ...asset, inspectionStatus: null },
    ]) {
      m.find.mockResolvedValueOnce(value);
      expect((await getPostMediaStatusAction(id)).ok).toBe(false);
    }
    expect(m.sign).not.toHaveBeenCalled();
  });
});
