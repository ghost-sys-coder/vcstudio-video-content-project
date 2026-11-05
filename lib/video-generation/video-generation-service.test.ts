import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  syntheticVideoModel,
  syntheticVideoPricing,
  syntheticVideoRequest,
} from "./video-generation-fixtures";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  membership: vi.fn(),
  asset: vi.fn(),
  scene: vi.fn(),
  project: vi.fn(),
  existing: vi.fn(),
  reserve: vi.fn(),
  update: vi.fn(),
  settle: vi.fn(),
  trigger: vi.fn(),
  environment: vi.fn(),
  model: vi.fn(),
  price: vi.fn(),
  sceneImage: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.user,
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  requireWorkspaceMembership: mocks.membership,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: mocks.asset,
}));
vi.mock("@/db/repositories/scenes.repository", () => ({
  findCurrentScene: mocks.scene,
}));
vi.mock("@/db/repositories/projects.repository", () => ({
  findProject: mocks.project,
}));
vi.mock("@/db/repositories/scene-video-reference.repository", () => ({
  findApprovedSceneVideoReference: mocks.sceneImage,
}));
vi.mock("@/db/repositories/video-generations.repository", () => ({
  findVideoGenerationByKey: mocks.existing,
  findVideoGeneration: vi.fn(),
}));
vi.mock("@/db/commands/video-generation-commands", async (original) => {
  const actual =
    await original<typeof import("@/db/commands/video-generation-commands")>();
  return {
    ...actual,
    reserveVideoGeneration: mocks.reserve,
    updateVideoGeneration: mocks.update,
    settleVideoGeneration: mocks.settle,
  };
});
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mocks.trigger } }));
vi.mock("@/lib/rate-limit/enforce-rate-limit", () => ({
  enforceRateLimit: mocks.rate,
}));
vi.mock("@/lib/env/server", () => ({
  getVideoGenerationEnvironment: mocks.environment,
}));
vi.mock("./video-security", () => ({
  getVideoSecurityEnvironment: () => ({
    IDEMPOTENCY_HASH_SECRET: "quote-test-secret-".repeat(3),
  }),
}));
vi.mock("./video-model-catalog", () => ({
  findVideoModel: mocks.model,
  findVideoPricing: mocks.price,
}));
vi.mock("@/lib/budgets/workspace-budget", () => ({
  loadEffectiveWorkspaceBudget: async () => ({
    dailyBudgetCents: 300,
    monthlyBudgetCents: 1500,
  }),
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: vi.fn(),
}));
import {
  quoteVideoGeneration,
  startVideoGeneration,
} from "./video-generation-service";
import { videoRequestDigest } from "./video-generation-quote";
const workspaceId = "11111111-1111-4111-8111-111111111111",
  userId = "22222222-2222-4222-8222-222222222222",
  assetId = "33333333-3333-4333-8333-333333333333";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rate.mockResolvedValue(undefined);
  mocks.user.mockResolvedValue({ id: userId });
  mocks.membership.mockResolvedValue({ workspaceId, role: "owner" });
  mocks.existing.mockResolvedValue(null);
  mocks.environment.mockReturnValue({
    ENABLE_VIDEO_GENERATION: true,
    GOOGLE_AI_VIDEO_GENERATION_API_KEY: "private",
    VIDEO_GENERATION_MAX_COST_CENTS: 150,
    VIDEO_GENERATION_DAILY_BUDGET_CENTS: 300,
    VIDEO_GENERATION_LIFETIME_BUDGET_CENTS: 1500,
    VIDEO_GENERATION_PRICING_JSON: [],
  });
  mocks.model.mockReturnValue(syntheticVideoModel);
  mocks.price.mockReturnValue(syntheticVideoPricing);
  mocks.reserve.mockResolvedValue({
    id: "44444444-4444-4444-8444-444444444444",
    created: true,
  });
  mocks.trigger.mockResolvedValue({ id: "run-test" });
  mocks.update.mockResolvedValue({});
  mocks.asset.mockResolvedValue({
    id: assetId,
    workspaceId,
    kind: "image",
    status: "ready",
    deletedAt: null,
    objectKey: "private/reference.png",
    contentType: "image/png",
    sizeBytes: 1000,
  });
});
describe("video service authorization, quotes and dispatch", () => {
  it("applies the workspace generation rate limit before creating a paid reservation", async () => {
    const quote = await quoteVideoGeneration(
      workspaceId,
      syntheticVideoRequest,
    );
    mocks.rate.mockRejectedValue(new Error("Rate limit reached"));
    await expect(
      startVideoGeneration(workspaceId, {
        request: syntheticVideoRequest,
        quoteToken: quote.token,
        idempotencyKey: "rate-limited-test-request",
      }),
    ).rejects.toThrow("Rate limit");
    expect(mocks.rate).toHaveBeenCalledWith({
      workspaceId,
      operation: "video_generation",
    });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("binds approved project image references to the exact authorized scene version", async () => {
    const target = {
      kind: "scene" as const,
      projectId: workspaceId,
      sceneId: assetId,
      sceneVersionId: userId,
      expectedSceneVersion: 1,
    };
    mocks.project.mockResolvedValue({ archivedAt: null });
    mocks.scene.mockResolvedValue({
      scene: { currentVersion: 1 },
      version: { id: userId },
    });
    mocks.sceneImage.mockResolvedValue({
      id: assetId,
      objectKey: "project/still.png",
      contentType: "image/png",
      sizeBytes: 1000,
    });
    const request = {
      ...syntheticVideoRequest,
      target,
      mode: "image_to_video" as const,
      inputs: [
        {
          assetId,
          source: "scene_image" as const,
          role: "first_frame" as const,
        },
      ],
    };
    await quoteVideoGeneration(workspaceId, request);
    expect(mocks.sceneImage).toHaveBeenCalledWith({
      workspaceId,
      projectId: workspaceId,
      sceneVersionId: userId,
      generationId: assetId,
    });
    expect(mocks.asset).not.toHaveBeenCalled();
    mocks.sceneImage.mockResolvedValue(null);
    await expect(
      quoteVideoGeneration(workspaceId, request),
    ).rejects.toMatchObject({ code: "reference_unavailable" });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it.each(["owner", "editor"])(
    "allows %s to quote without starting or reserving paid work",
    async (role) => {
      mocks.membership.mockResolvedValue({ workspaceId, role });
      const quote = await quoteVideoGeneration(
        workspaceId,
        syntheticVideoRequest,
      );
      expect(quote.maximumCostCents).toBe(11);
      expect(quote.token).not.toContain("private");
      expect(mocks.membership).toHaveBeenCalledWith({ workspaceId, userId });
      expect(mocks.reserve).not.toHaveBeenCalled();
      expect(mocks.trigger).not.toHaveBeenCalled();
    },
  );
  it("denies a viewer, revoked membership and a tampered workspace before writes", async () => {
    mocks.membership.mockResolvedValue({ workspaceId, role: "viewer" });
    await expect(
      quoteVideoGeneration(workspaceId, syntheticVideoRequest),
    ).rejects.toThrow();
    mocks.membership.mockRejectedValue(new Error("Membership required"));
    await expect(
      quoteVideoGeneration(assetId, syntheticVideoRequest),
    ).rejects.toThrow();
    expect(mocks.asset).not.toHaveBeenCalled();
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("authorizes each referenced asset under the explicit workspace", async () => {
    const request = {
      ...syntheticVideoRequest,
      mode: "image_to_video" as const,
      inputs: [{ assetId, role: "first_frame" as const }],
    };
    await quoteVideoGeneration(workspaceId, request);
    expect(mocks.asset).toHaveBeenCalledWith({
      workspaceId,
      mediaAssetId: assetId,
    });
    mocks.asset.mockResolvedValue(null);
    await expect(
      quoteVideoGeneration(workspaceId, request),
    ).rejects.toMatchObject({ code: "asset_unavailable" });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("reserves a verified estimate before one idempotent dispatch", async () => {
    const quote = await quoteVideoGeneration(
      workspaceId,
      syntheticVideoRequest,
    );
    await startVideoGeneration(workspaceId, {
      request: syntheticVideoRequest,
      quoteToken: quote.token,
      idempotencyKey: "stable-idempotency-key",
    });
    expect(mocks.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        userId,
        quoteId: quote.quoteId,
        estimatedCostCents: 11,
        request: syntheticVideoRequest,
      }),
    );
    expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.trigger.mock.invocationCallOrder[0]!,
    );
    expect(mocks.trigger).toHaveBeenCalledWith(
      "video-generation",
      expect.objectContaining({ workspaceId }),
      { idempotencyKey: expect.stringContaining("video:") },
    );
  });
  it("refuses changed inputs or pricing after quote issuance", async () => {
    const quote = await quoteVideoGeneration(
      workspaceId,
      syntheticVideoRequest,
    );
    await expect(
      startVideoGeneration(workspaceId, {
        request: {
          ...syntheticVideoRequest,
          prompt: "A different paid request.",
        },
        quoteToken: quote.token,
        idempotencyKey: "stable-idempotency-key",
      }),
    ).rejects.toMatchObject({ code: "quote_changed" });
    mocks.price.mockReturnValue({
      ...syntheticVideoPricing,
      revision: "changed",
    });
    await expect(
      startVideoGeneration(workspaceId, {
        request: syntheticVideoRequest,
        quoteToken: quote.token,
        idempotencyKey: "stable-idempotency-key",
      }),
    ).rejects.toMatchObject({ code: "quote_changed" });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("returns an existing identical request after quote expiry but conflicts on changed inputs", async () => {
    mocks.existing.mockResolvedValue({
      id: assetId,
      requestedByUserId: userId,
      requestFingerprint: videoRequestDigest(syntheticVideoRequest),
      triggerRunId: "existing",
    });
    expect(
      await startVideoGeneration(workspaceId, {
        request: syntheticVideoRequest,
        quoteToken: "expired-but-existing-quote",
        idempotencyKey: "stable-idempotency-key",
      }),
    ).toMatchObject({ id: assetId });
    await expect(
      startVideoGeneration(workspaceId, {
        request: { ...syntheticVideoRequest, title: "Another title" },
        quoteToken: "expired-but-existing-quote",
        idempotencyKey: "stable-idempotency-key",
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("preserves a saved request when dispatch acknowledgement is uncertain", async () => {
    const quote = await quoteVideoGeneration(
      workspaceId,
      syntheticVideoRequest,
    );
    mocks.trigger.mockRejectedValue(new Error("Timed out after delivery"));
    expect(
      await startVideoGeneration(workspaceId, {
        request: syntheticVideoRequest,
        quoteToken: quote.token,
        idempotencyKey: "stable-idempotency-key",
      }),
    ).toMatchObject({ dispatched: false });
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("rejects scene revision changes and project native audio before any generation", async () => {
    const target = {
      kind: "scene" as const,
      projectId: workspaceId,
      sceneId: assetId,
      sceneVersionId: userId,
      expectedSceneVersion: 1,
    };
    mocks.project.mockResolvedValue({ archivedAt: null });
    mocks.scene.mockResolvedValue({
      scene: { currentVersion: 2 },
      version: { id: userId },
    });
    await expect(
      quoteVideoGeneration(workspaceId, { ...syntheticVideoRequest, target }),
    ).rejects.toMatchObject({ code: "scene_changed" });
    mocks.scene.mockResolvedValue({
      scene: { currentVersion: 1 },
      version: { id: userId },
    });
    await expect(
      quoteVideoGeneration(workspaceId, {
        ...syntheticVideoRequest,
        target,
        audio: "native",
      }),
    ).rejects.toMatchObject({ code: "project_narration" });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
});
