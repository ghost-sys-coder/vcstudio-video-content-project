import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  project: vi.fn(),
  scene: vi.fn(),
  asset: vi.fn(),
  selection: vi.fn(),
  append: vi.fn(),
  copy: vi.fn(),
  remove: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("./video-generation-service", () => ({
  authorizeVideoWorkspace: mocks.auth,
}));
vi.mock("@/db/repositories/projects.repository", () => ({
  findProject: mocks.project,
}));
vi.mock("@/db/repositories/scenes.repository", () => ({
  findCurrentScene: mocks.scene,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: mocks.asset,
}));
vi.mock("@/db/repositories/scene-visual-selections.repository", () => ({
  findSceneVisualSelection: mocks.selection,
}));
vi.mock("@/db/commands/scene-visual-selection-command", () => ({
  appendSceneVisualSelection: mocks.append,
}));
vi.mock("@/lib/storage/copy-project-video", () => ({
  copyProjectVideo: mocks.copy,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  deleteMediaAssetObject: mocks.remove,
  createMediaAssetDownloadUrl: mocks.sign,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: vi.fn(),
}));
import {
  saveSceneVideoSelection,
  reviewSceneVideoSelection,
  sceneVideoPreviewUrl,
} from "./scene-video-service";
const workspaceId = "11111111-1111-4111-8111-111111111111",
  projectId = "22222222-2222-4222-8222-222222222222",
  sceneId = "33333333-3333-4333-8333-333333333333",
  versionId = "44444444-4444-4444-8444-444444444444",
  assetId = "55555555-5555-4555-8555-555555555555",
  userId = "66666666-6666-4666-8666-666666666666";
const input = {
  projectId,
  sceneId,
  sceneVersionId: versionId,
  expectedRevision: 0,
  kind: "video" as const,
  assetId,
  fit: "contain" as const,
  trimStartMilliseconds: 500,
  loop: true,
};
const metadata = {
  kind: "video",
  codec: "h264",
  displayWidth: 1280,
  displayHeight: 720,
  durationMilliseconds: 6000,
};
const selection = {
  id: assetId,
  workspaceId,
  projectId,
  sceneId,
  sceneVersionId: versionId,
  kind: "video",
  sourceAssetId: assetId,
  objectKey: "project-owned/copy.mp4",
  width: 1280,
  height: 720,
  durationMilliseconds: 6000,
  fit: "contain",
  trimStartMilliseconds: 500,
  loop: true,
  reviewStatus: "pending",
  revision: 1,
  updatedByUserId: userId,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ workspaceId, userId, role: "owner" });
  mocks.project.mockResolvedValue({
    defaultVisualMedia: "image",
    archivedAt: null,
  });
  mocks.scene.mockResolvedValue({
    scene: { currentVersion: 1 },
    version: { id: versionId },
  });
  mocks.asset.mockResolvedValue({
    id: assetId,
    kind: "video",
    status: "ready",
    deletedAt: null,
    inspectionStatus: "succeeded",
    verifiedMetadata: metadata,
    objectKey: "shared-library/original.mp4",
  });
  mocks.selection.mockResolvedValue(selection);
  mocks.append.mockResolvedValue(assetId);
  mocks.copy.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.sign.mockResolvedValue("https://private.example/signed");
});
describe("scene footage copy and review boundaries", () => {
  it("creates an independent project copy and leaves it pending review", async () => {
    await saveSceneVideoSelection(workspaceId, input);
    expect(mocks.copy).toHaveBeenCalledWith({
      sourceKey: "shared-library/original.mp4",
      destinationKey: expect.stringMatching(
        new RegExp(
          `^workspaces/${workspaceId}/projects/${projectId}/scenes/${sceneId}/versions/${versionId}/clips/.*\\.mp4$`,
        ),
      ),
    });
    expect(mocks.append).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        projectId,
        expectedRevision: 0,
        selection: expect.objectContaining({
          reviewStatus: "pending",
          fit: "contain",
          loop: true,
          sourceAssetId: assetId,
        }),
      }),
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("refuses pending inspection, deleted assets and stale scene versions before copying", async () => {
    mocks.asset.mockResolvedValue({
      kind: "video",
      status: "ready",
      inspectionStatus: null,
    });
    await expect(
      saveSceneVideoSelection(workspaceId, input),
    ).rejects.toMatchObject({ code: "video_unverified" });
    mocks.asset.mockResolvedValue({
      kind: "video",
      status: "ready",
      inspectionStatus: "succeeded",
      deletedAt: new Date(),
      verifiedMetadata: metadata,
    });
    await expect(
      saveSceneVideoSelection(workspaceId, input),
    ).rejects.toMatchObject({ code: "video_unverified" });
    await expect(
      saveSceneVideoSelection(workspaceId, {
        ...input,
        sceneVersionId: assetId,
      }),
    ).rejects.toMatchObject({ code: "scene_changed" });
    expect(mocks.copy).not.toHaveBeenCalled();
  });
  it("cleans only an uncommitted copy when a concurrent revision wins", async () => {
    mocks.append.mockRejectedValue(new Error("Revision conflict"));
    await expect(saveSceneVideoSelection(workspaceId, input)).rejects.toThrow(
      "Revision conflict",
    );
    const destination = mocks.copy.mock.calls[0]![0].destinationKey;
    expect(mocks.remove).toHaveBeenCalledWith(destination);
    expect(mocks.remove).not.toHaveBeenCalledWith(
      "shared-library/original.mp4",
    );
  });
  it("makes review explicit, revision-bound and append-only", async () => {
    await reviewSceneVideoSelection(workspaceId, {
      projectId,
      sceneId,
      expectedRevision: 1,
      reviewStatus: "approved",
    });
    expect(mocks.append).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: 1,
        selection: expect.objectContaining({
          objectKey: "project-owned/copy.mp4",
          reviewStatus: "approved",
        }),
      }),
    );
    expect(mocks.copy).not.toHaveBeenCalled();
    await expect(
      reviewSceneVideoSelection(workspaceId, {
        projectId,
        sceneId,
        expectedRevision: 2,
        reviewStatus: "approved",
      }),
    ).rejects.toMatchObject({ code: "scene_changed" });
  });
  it("does not sign or mutate another workspace's missing project", async () => {
    mocks.project.mockResolvedValue(null);
    await expect(
      sceneVideoPreviewUrl(workspaceId, { projectId, sceneId }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.append).not.toHaveBeenCalled();
  });
});
