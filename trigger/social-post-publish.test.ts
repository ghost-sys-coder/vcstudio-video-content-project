import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  run: undefined as
    | undefined
    | ((input: {
        workspaceId: string;
        postId: string;
        targetId: string;
      }) => Promise<unknown>),
  target: vi.fn(),
  post: vi.fn(),
  connection: vi.fn(),
  media: vi.fn(),
  publish: vi.fn(),
  finish: vi.fn(),
  markPublished: vi.fn(),
  markPublishing: vi.fn(),
  markFailed: vi.fn(),
  thumbnail: vi.fn(),
  reconcile: vi.fn(),
  checkpoint: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@trigger.dev/sdk", () => ({
  task: (definition: { run: NonNullable<typeof m.run> }) => {
    m.run = definition.run;
    return definition;
  },
  wait: { for: vi.fn() },
  logger: { error: vi.fn() },
}));
vi.mock("@/db/commands/platform-connection-commands", () => ({
  markPlatformConnectionUnusable: vi.fn(),
  updatePlatformConnectionTokens: vi.fn(),
}));
vi.mock("@/db/commands/social-post-target-commands", () => ({
  markSocialPostTargetFailed: m.markFailed,
  markSocialPostTargetPublished: m.markPublished,
  markSocialPostTargetPublishing: m.markPublishing,
  recordSocialPostTargetOperation: m.checkpoint,
  reconcileSocialPostStatus: m.reconcile,
  recordSocialYouTubeThumbnail: m.thumbnail,
}));
vi.mock("@/db/repositories/publishing.repository", () => ({
  findPlatformConnectionWithTokens: m.connection,
}));
vi.mock("@/db/repositories/social-posts.repository", () => ({
  findSocialPost: m.post,
  findSocialPostTargetById: m.target,
  listSocialPostMedia: m.media,
}));
vi.mock("@/lib/crypto/secret-box", () => ({
  openSecret: () => "test-token",
  sealSecret: () => "test-sealed",
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({
    PLATFORM_TOKEN_ENCRYPTION_KEY: "test",
    SOCIAL_POST_ASSET_URL_TTL_SECONDS: 3600,
  }),
}));
vi.mock("@/lib/publishing/social-post-registry", () => ({
  createSocialPostProvider: () => ({ publishPost: m.publish }),
  createConnectionOAuthProvider: () => ({ refreshTokens: vi.fn() }),
}));
vi.mock("@/lib/publishing/provider-registry", () => ({
  PlatformNotConfiguredError: class extends Error {},
  createVideoPublishProvider: () => ({ setThumbnail: vi.fn() }),
}));
vi.mock("@/lib/social/finish-youtube-thumbnail", () => ({
  finishSocialYouTubeThumbnail: m.finish,
}));
vi.mock("@/lib/social/validate-youtube-post", () => ({
  validateYouTubePost: m.validate,
  YouTubePostSettingsError: class extends Error {},
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  createMediaAssetDownloadUrl: () => "https://storage.example/video.mp4",
}));
await import("./social-post-publish");
import { mcpIds } from "@/lib/test-utils/mcp-fixtures";
import { socialYouTubeSettingsSchema } from "@studio/contracts/publishing";
const input = {
  workspaceId: mcpIds.workspace,
  postId: mcpIds.post,
  targetId: mcpIds.destination,
};
const youtubeSettings = socialYouTubeSettingsSchema.parse({
  madeForKids: false,
  containsSyntheticMedia: true,
  title: "Exact title",
});
const target = (overrides: Record<string, unknown> = {}) => ({
  id: input.targetId,
  workspaceId: input.workspaceId,
  postId: input.postId,
  connectionId: mcpIds.connection,
  platform: "youtube",
  status: "queued",
  youtubeSettings,
  youtubeThumbnailAssetId: mcpIds.asset,
  youtubeThumbnailStatus: "pending",
  providerOperationId: null,
  providerOperationSecretSealed: null,
  ...overrides,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.target.mockResolvedValue(target());
  m.post.mockResolvedValue({ id: mcpIds.post, bodyPlainText: "Shared copy" });
  m.connection.mockResolvedValue({
    id: mcpIds.connection,
    platform: "youtube",
    status: "active",
    externalAccountId: "channel123",
    accessTokenSealed: "sealed",
    accessTokenExpiresAt: null,
  });
  m.media.mockResolvedValue([
    {
      kind: "video",
      unavailable: false,
      objectKey: "video.mp4",
      contentType: "video/mp4",
      sizeBytes: 4,
      altText: "",
      originalFileName: "video.mp4",
    },
  ]);
  m.publish.mockResolvedValue({
    externalPostId: "video123",
    externalPostUrl: "https://www.youtube.com/watch?v=video123",
    completionStage: "published",
  });
  m.finish.mockResolvedValue(undefined);
  m.validate.mockResolvedValue(undefined);
});
describe("Social publishing worker delivery and finishing", () => {
  it("refuses a thumbnail removed after dispatch before uploading a video", async () => {
    m.validate.mockRejectedValue(new Error("missing thumbnail"));
    await m.run!(input);
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ category: "invalid_metadata" }),
    );
  });
  it("sends saved YouTube metadata and finishes the separate thumbnail after recording the upload", async () => {
    await m.run!(input);
    expect(m.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        youtubeSettings,
        media: [expect.objectContaining({ kind: "video" })],
      }),
    );
    expect(m.markPublished).toHaveBeenCalledWith(
      expect.objectContaining({
        externalPostId: "video123",
        completionStage: "published",
      }),
    );
    expect(m.finish).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: "video123",
        target: expect.objectContaining({
          youtubeThumbnailAssetId: mcpIds.asset,
        }),
      }),
    );
    expect(m.markPublished.mock.invocationCallOrder[0]).toBeLessThan(
      m.finish.mock.invocationCallOrder[0],
    );
  });
  it("retries only finishing on an already uploaded video", async () => {
    m.target.mockResolvedValue(
      target({
        status: "published",
        externalPostId: "video123",
        youtubeThumbnailStatus: "failed",
      }),
    );
    await m.run!(input);
    expect(m.finish).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: "video123" }),
    );
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.markPublishing).not.toHaveBeenCalled();
    expect(m.media).not.toHaveBeenCalled();
    expect(m.reconcile).toHaveBeenCalledWith({
      workspaceId: input.workspaceId,
      postId: input.postId,
    });
  });
  it("never turns a confirmed upload into a failed video when finishing throws", async () => {
    m.target.mockResolvedValue(
      target({
        status: "published",
        externalPostId: "video123",
        youtubeThumbnailStatus: "failed",
      }),
    );
    m.finish.mockRejectedValue(new Error("storage unavailable"));
    await m.run!(input);
    expect(m.markFailed).not.toHaveBeenCalled();
    expect(m.thumbnail).toHaveBeenCalledWith(
      expect.objectContaining({ state: "failed" }),
    );
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("records TikTok inbox delivery without a public post URL", async () => {
    m.target.mockResolvedValue(
      target({
        platform: "tiktok",
        youtubeSettings: null,
        youtubeThumbnailAssetId: null,
        youtubeThumbnailStatus: null,
      }),
    );
    m.publish.mockResolvedValue({
      externalPostId: "inbox123",
      externalPostUrl: "https://www.tiktok.com/",
      completionStage: "inbox_delivered",
    });
    expect(await m.run!(input)).toMatchObject({ status: "inbox_delivered" });
    expect(m.markPublished).toHaveBeenCalledWith({
      targetId: input.targetId,
      externalPostId: "inbox123",
      externalPostUrl: null,
      completionStage: "inbox_delivered",
    });
    expect(m.finish).not.toHaveBeenCalled();
  });
  it("preserves an already delivered TikTok target on retries", async () => {
    m.target.mockResolvedValue(
      target({ platform: "tiktok", status: "inbox_delivered" }),
    );
    expect(await m.run!(input)).toMatchObject({ status: "inbox_delivered" });
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("rejects mismatched workspace or post IDs without mutating the target", async () => {
    m.target.mockResolvedValue(target({ postId: mcpIds.asset }));
    await m.run!(input);
    expect(m.markFailed).not.toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
  });
});
