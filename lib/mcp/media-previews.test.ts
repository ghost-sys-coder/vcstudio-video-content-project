import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicationPreview } from "@studio/contracts";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  media: vi.fn(),
  request: vi.fn(async () => {
    throw new Error("Unexpected storage request");
  }),
  environment: {
    R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
    R2_BUCKET_NAME: "studio",
    R2_REGION: "auto",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS: 300,
  },
}));
vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => mocks.environment,
}));
vi.mock("@/db/repositories/social-posts.repository", () => ({
  listSocialPostMedia: mocks.media,
}));
vi.mock("@/lib/storage/r2-client", async () => {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return {
    getR2Client: () =>
      new S3Client({
        endpoint: mocks.environment.R2_ENDPOINT,
        region: mocks.environment.R2_REGION,
        credentials: {
          accessKeyId: mocks.environment.R2_ACCESS_KEY_ID,
          secretAccessKey: mocks.environment.R2_SECRET_ACCESS_KEY,
        },
        requestHandler: { handle: mocks.request },
      }),
  };
});
import {
  getMcpMediaPreviewOrigin,
  loadMcpMediaPreviews,
} from "./media-previews";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import { mcpIds } from "@/lib/test-utils/mcp-fixtures";

const preview: PublicationPreview = {
  postId: mcpIds.post,
  version: 1,
  text: "Imported image",
  media: [
    {
      id: mcpIds.asset,
      name: "Imported portrait",
      kind: "image",
      contentType: "image/png",
      sizeBytes: 100,
      etag: "etag",
    },
  ],
  destinations: [],
  scheduledAt: null,
  timezone: "UTC",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.environment.R2_ENDPOINT = "https://account.r2.cloudflarestorage.com";
  mocks.environment.R2_BUCKET_NAME = "studio";
  mocks.media.mockResolvedValue([
    {
      sourceId: mcpIds.asset,
      objectKey: `workspaces/${mcpIds.workspace}/media/image.png`,
      kind: "image",
      unavailable: false,
    },
  ]);
});

describe("private MCP review media and resource origins", () => {
  it.each([
    [
      "https://account.r2.cloudflarestorage.com",
      "studio",
      "https://studio.account.r2.cloudflarestorage.com",
    ],
    [
      "https://account.r2.cloudflarestorage.com",
      "studio.images",
      "https://account.r2.cloudflarestorage.com",
    ],
    ["http://127.0.0.1:9000", "studio", "http://127.0.0.1:9000"],
  ])("matches the SDK origin for %s / %s", async (endpoint, bucket, origin) => {
    mocks.environment.R2_ENDPOINT = endpoint;
    mocks.environment.R2_BUCKET_NAME = bucket;
    expect(await getMcpMediaPreviewOrigin()).toBe(origin);
    const signed = new URL(
      await createMediaAssetDownloadUrl("preview.png", 600),
    );
    expect(signed.origin).toBe(origin);
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("allows the exact private image origin without returning signing credentials in CSP", async () => {
    const [media, origin] = await Promise.all([
      loadMcpMediaPreviews(mcpIds.workspace, preview),
      getMcpMediaPreviewOrigin(),
    ]);
    const signed = new URL(media[0].url);
    expect(signed.origin).toBe(origin);
    expect(signed.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(origin).not.toContain("?");
    expect(origin).not.toContain("test-access-key");
    expect(origin).not.toContain("*");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("refuses to sign another workspace's media", async () => {
    mocks.media.mockResolvedValue([
      {
        sourceId: mcpIds.asset,
        objectKey: "workspaces/other-workspace/media/image.png",
        kind: "image",
        unavailable: false,
      },
    ]);
    await expect(
      loadMcpMediaPreviews(mcpIds.workspace, preview),
    ).rejects.toMatchObject({ code: "invalid_media" });
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
