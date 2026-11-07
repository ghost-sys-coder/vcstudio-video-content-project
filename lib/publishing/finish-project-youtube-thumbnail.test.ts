import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  publication: vi.fn(),
  connection: vi.fn(),
  finish: vi.fn(),
  record: vi.fn(),
  upload: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/db/repositories/publishing.repository", () => ({
  findVideoPublication: m.publication,
  findPlatformConnectionWithTokens: m.connection,
}));
vi.mock("@/db/commands/publication-finishing-commands", () => ({
  recordFinishingStep: m.record,
}));
vi.mock("@/db/commands/platform-connection-commands", () => ({
  updatePlatformConnectionTokens: vi.fn(),
}));
vi.mock("./provider-registry", () => ({
  createVideoPublishProvider: () => ({
    publishVideo: m.upload,
    setThumbnail: vi.fn(),
    refreshTokens: m.refresh,
  }),
}));
vi.mock("./run-youtube-finishing", () => ({ runYouTubeFinishing: m.finish }));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({
    ENABLE_VIDEO_PUBLISHING: true,
    PLATFORM_TOKEN_ENCRYPTION_KEY: "test",
  }),
}));
vi.mock("@/lib/crypto/secret-box", () => ({ openSecret: () => "test-token" }));
import { finishProjectYouTubeThumbnail } from "./finish-project-youtube-thumbnail";
const input = {
  workspaceId: "workspace",
  projectId: "project",
  publicationId: "publication",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.publication.mockResolvedValue({
    id: "publication",
    platform: "youtube",
    status: "succeeded",
    externalVideoId: "video123",
    releasePackageId: "release",
    connectionId: "channel",
  });
  m.connection.mockResolvedValue({
    id: "channel",
    status: "active",
    accessTokenSealed: "sealed",
    accessTokenExpiresAt: null,
    scopes: "https://www.googleapis.com/auth/youtube.upload",
  });
});
describe("project thumbnail-only retry", () => {
  it("runs only the thumbnail step against the original YouTube video", async () => {
    await finishProjectYouTubeThumbnail(input, vi.fn());
    expect(m.publication).toHaveBeenCalledWith(input);
    expect(m.finish).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: "video123",
        onlyStep: "thumbnail",
        captions: null,
        releasePackageId: "release",
      }),
    );
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("preserves the uploaded publication when its authorization is unavailable", async () => {
    m.connection.mockResolvedValue(null);
    expect(await finishProjectYouTubeThumbnail(input, vi.fn())).toMatchObject({
      status: "thumbnail_failed",
    });
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({ step: "thumbnail", state: "failed" }),
    );
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("rejects a foreign or unpublished record before touching credentials or providers", async () => {
    m.publication.mockResolvedValue(null);
    expect(await finishProjectYouTubeThumbnail(input, vi.fn())).toMatchObject({
      status: "unavailable",
    });
    expect(m.connection).not.toHaveBeenCalled();
    expect(m.finish).not.toHaveBeenCalled();
  });
});
