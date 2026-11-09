import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  context: vi.fn(),
  find: vi.fn(),
  trigger: vi.fn(),
  retrieve: vi.fn(),
  limit: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: m.trigger },
  runs: { retrieve: m.retrieve },
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.find,
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: m.context,
}));
vi.mock("@/lib/rate-limit/enforce-rate-limit", () => ({
  enforceRateLimit: m.limit,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  createMediaAssetDownloadUrl: m.sign,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({
    PLATFORM_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  }),
}));
import {
  requestVideoThumbnail,
  checkVideoThumbnail,
} from "./video-thumbnail-service";
const workspace = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  user = "33333333-3333-4333-8333-333333333333";
const input = {
  mediaAssetId: id,
  requestId: "44444444-4444-4444-8444-444444444444",
};
const asset = {
  id,
  workspaceId: workspace,
  kind: "video",
  status: "ready",
  inspectionStatus: "succeeded",
  verifiedMetadata: null,
  objectKey: "private.mp4",
  title: "Video",
  altText: "",
  tags: [],
  createdAt: new Date(),
  deletedAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.context.mockResolvedValue({
    activeMembership: { workspaceId: workspace, role: "owner" },
    user: { id: user },
  });
  m.find.mockResolvedValue(asset);
  m.trigger.mockResolvedValue({ id: "run-test" });
  m.retrieve.mockResolvedValue({ status: "EXECUTING" });
  m.limit.mockResolvedValue(undefined);
  m.sign.mockResolvedValue("signed-url");
});
describe("authorized on-demand thumbnail work", () => {
  it("scopes the asset and deduplicates identical requests; proof hides worker details", async () => {
    const result = await requestVideoThumbnail({
      ...input,
      workspaceId: "injected",
    });
    expect(result.status).toBe("pending");
    expect(m.find).toHaveBeenCalledExactlyOnceWith({
      workspaceId: workspace,
      mediaAssetId: id,
    });
    expect(m.trigger).toHaveBeenCalledWith(
      "media-inspection",
      { kind: "video_thumbnail", workspaceId: workspace, mediaAssetId: id },
      {
        idempotencyKey: `video-thumbnail:v1:${workspace}:${id}:${input.requestId}`,
      },
    );
    expect(JSON.stringify(result)).not.toContain("run-test");
    if (result.status !== "pending") throw new Error("expected pending");
    expect(await checkVideoThumbnail(result.proof)).toEqual(result);
    expect(m.retrieve).toHaveBeenCalledExactlyOnceWith("run-test");
  });
  it.each(["viewer", null])(
    "denies unauthorized access before database or worker calls",
    async (role) => {
      m.context.mockResolvedValue(
        role
          ? {
              activeMembership: { workspaceId: workspace, role },
              user: { id: user },
            }
          : null,
      );
      expect((await requestVideoThumbnail(input)).status).toBe("failed");
      expect(m.find).not.toHaveBeenCalled();
      expect(m.trigger).not.toHaveBeenCalled();
    },
  );
  it("rejects malformed requests before resolving identity", async () => {
    expect((await requestVideoThumbnail({ mediaAssetId: "bad" })).status).toBe(
      "failed",
    );
    expect(m.context).not.toHaveBeenCalled();
  });
  it("does not accept a proof from another user or a tampered proof", async () => {
    const result = await requestVideoThumbnail(input);
    if (result.status !== "pending") throw new Error("expected pending");
    m.context.mockResolvedValue({
      activeMembership: { workspaceId: workspace, role: "owner" },
      user: { id: "55555555-5555-4555-8555-555555555555" },
    });
    expect((await checkVideoThumbnail(result.proof)).status).toBe("failed");
    expect(
      (await checkVideoThumbnail(result.proof.slice(0, -4) + "abcd")).status,
    ).toBe("failed");
    expect(m.retrieve).not.toHaveBeenCalled();
  });
  it("does not dispatch when the rate limit is exceeded", async () => {
    m.limit.mockRejectedValue(new Error("limit"));
    expect((await requestVideoThumbnail(input)).status).toBe("failed");
    expect(m.trigger).not.toHaveBeenCalled();
  });
  it("returns the stored preview without new worker work", async () => {
    m.find.mockResolvedValue({
      ...asset,
      verifiedMetadata: {
        kind: "video",
        thumbnail: {
          version: 1,
          width: 640,
          height: 360,
          timestampMilliseconds: 1000,
        },
      },
    });
    const result = await requestVideoThumbnail(input);
    expect(result).toMatchObject({
      status: "ready",
      asset: { thumbnailUrl: "signed-url" },
    });
    expect(m.trigger).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private.mp4");
  });
  it("reports a terminal job without a saved thumbnail as failed", async () => {
    const result = await requestVideoThumbnail(input);
    if (result.status !== "pending") throw new Error("expected pending");
    m.retrieve.mockResolvedValue({ status: "COMPLETED" });
    expect(await checkVideoThumbnail(result.proof)).toMatchObject({
      status: "failed",
      error: expect.stringContaining("original video"),
    });
  });
});
