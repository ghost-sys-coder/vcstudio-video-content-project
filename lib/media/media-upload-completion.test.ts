import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  user: vi.fn(),
  membership: vi.fn(),
  find: vi.fn(),
  inspect: vi.fn(),
  prepare: vi.fn(),
  trigger: vi.fn(),
  attach: vi.fn(),
  fail: vi.fn(),
  ready: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: m.trigger } }));
vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: m.user,
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  requireWorkspaceMembership: m.membership,
}));
vi.mock("@/lib/env/server", () => ({
  getMediaLibraryEnvironment: () => ({
    MAX_MEDIA_IMAGE_BYTES: 100000,
    MAX_MEDIA_VIDEO_BYTES: 100000,
    MAX_MEDIA_VIDEO_DURATION_SECONDS: 60,
  }),
}));
vi.mock("@/lib/media/media-upload-limits", () => ({
  checkMediaUpload: () => ({ allowed: true }),
}));
vi.mock("@/db/commands/media-asset-commands", () => ({
  markMediaAssetFailed: m.fail,
  markMediaAssetReady: m.ready,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.find,
}));
vi.mock("@/lib/storage/object-key", () => ({
  isMediaLibraryObjectKey: () => true,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  createMediaAssetDownloadUrl: m.sign,
  inspectMediaAsset: m.inspect,
}));
vi.mock("@/db/commands/media-inspection-commands", () => ({
  prepareMediaAssetInspection: m.prepare,
  attachMediaAssetInspectionRun: m.attach,
}));
import { POST } from "@/app/api/workspaces/[workspaceId]/media/complete/route";
const workspaceId = "11111111-1111-4111-8111-111111111111",
  mediaAssetId = "22222222-2222-4222-8222-222222222222";
const asset = {
  id: mediaAssetId,
  workspaceId,
  kind: "video",
  status: "pending",
  inspectionStatus: "pending",
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
function request() {
  return new Request("https://studio.example/api/media/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mediaAssetId,
      objectKey: "private-key",
      contentType: "video/mp4",
      sizeBytes: 10,
      durationMilliseconds: 5000,
    }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({ id: "user" });
  m.membership.mockResolvedValue({ role: "owner" });
  m.find.mockResolvedValue(asset);
  m.inspect.mockResolvedValue({ sizeBytes: 10, width: null, height: null });
  m.prepare.mockResolvedValue(asset);
  m.trigger.mockResolvedValue({ id: "inspection-run" });
  m.attach.mockResolvedValue(undefined);
  m.fail.mockResolvedValue(undefined);
});
describe("video upload completion", () => {
  it("returns a client-safe pending attachment after dispatching inspection", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ workspaceId }),
    });
    expect(response.status).toBe(202);
    const result = await response.json();
    expect(result).toMatchObject({
      inspectionPending: true,
      asset: { id: mediaAssetId, inspectionPending: true, previewUrl: "" },
    });
    expect(JSON.stringify(result)).not.toContain("private-key");
    expect(m.sign).not.toHaveBeenCalled();
    expect(m.trigger).toHaveBeenCalledOnce();
    expect(m.attach).toHaveBeenCalledOnce();
  });
  it("does not present an attachment when inspection could not be dispatched", async () => {
    m.trigger.mockRejectedValueOnce(new Error("unavailable"));
    const response = await POST(request(), {
      params: Promise.resolve({ workspaceId }),
    });
    expect(response.status).toBe(400);
    expect(m.fail).toHaveBeenCalledWith({ workspaceId, mediaAssetId });
    expect(await response.json()).not.toHaveProperty("asset");
  });
});
