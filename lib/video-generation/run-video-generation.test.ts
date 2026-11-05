import { beforeEach, describe, it, expect, vi } from "vitest";
import type { VideoGeneration } from "@/db/schema";
import {
  syntheticVideoModel,
  syntheticVideoPricing,
  syntheticVideoRequest,
} from "./video-generation-fixtures";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  asset: vi.fn(),
  member: vi.fn(),
  update: vi.fn(),
  settle: vi.fn(),
  save: vi.fn(),
  put: vi.fn(),
  inspect: vi.fn(),
  start: vi.fn(),
  check: vi.fn(),
  download: vi.fn(),
  wait: vi.fn(),
}));
vi.mock("@/db/repositories/video-generations.repository", () => ({
  findVideoGeneration: mocks.read,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: mocks.asset,
}));
vi.mock("@/db/repositories/workspaces.repository", () => ({
  findWorkspaceMembership: mocks.member,
}));
vi.mock("@/db/commands/video-generation-commands", () => ({
  updateVideoGeneration: mocks.update,
  settleVideoGeneration: mocks.settle,
}));
vi.mock("@/db/commands/generated-video-asset-command", () => ({
  saveGeneratedVideoAsset: mocks.save,
}));
vi.mock("@/lib/env/server", () => ({
  getVideoGenerationEnvironment: () => ({ ENABLE_VIDEO_GENERATION: true }),
}));
vi.mock("@/lib/storage/scene-clip-storage", () => ({
  downloadSceneStillBytes: vi.fn(),
  putSceneClip: mocks.put,
}));
vi.mock("./video-security", () => ({
  getVideoSecurityEnvironment: () => ({
    PLATFORM_TOKEN_ENCRYPTION_KEY: "00".repeat(32),
  }),
}));
vi.mock("./prepare-video-output", () => ({
  prepareVideoOutput: mocks.inspect,
}));
vi.mock("./video-provider-registry", () => ({
  createVideoProvider: () => ({
    start: mocks.start,
    check: mocks.check,
    download: mocks.download,
  }),
}));
import { runVideoGeneration } from "./run-video-generation";
import { VideoProviderError } from "./video-provider";
const scope = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  generationId: "22222222-2222-4222-8222-222222222222",
};
let row: VideoGeneration;
function job(): VideoGeneration {
  return {
    id: scope.generationId,
    workspaceId: scope.workspaceId,
    projectId: null,
    sceneId: null,
    sceneVersionId: null,
    targetDetached: false,
    requestedByUserId: "33333333-3333-4333-8333-333333333333",
    quoteId: "44444444-4444-4444-8444-444444444444",
    idempotencyKey: "test-idempotency-key",
    requestFingerprint: "a".repeat(64),
    request: syntheticVideoRequest,
    modelSnapshot: syntheticVideoModel,
    pricingSnapshot: syntheticVideoPricing,
    inputAssets: [],
    finalPrompt: syntheticVideoRequest.prompt,
    promptTemplateVersion: "test-v1",
    status: "queued",
    providerJobId: null,
    providerRequestId: null,
    encryptedOutput: null,
    triggerRunId: null,
    attemptCount: 0,
    estimatedCostCents: 11,
    actualCostCents: null,
    inputUnits: null,
    outputUnits: null,
    outputAssetId: null,
    errorCode: null,
    safeErrorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
const metadata = {
  kind: "video" as const,
  codec: "h264",
  width: 1280,
  height: 720,
  displayWidth: 1280,
  displayHeight: 720,
  durationMilliseconds: 4000,
  container: "mp4",
  rotationDegrees: 0,
  averageFrameRate: 24,
  variableFrameRate: false,
  hasAudio: false,
  audioCodec: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  row = job();
  mocks.read.mockImplementation(async () => row);
  mocks.member.mockResolvedValue({ role: "owner" });
  mocks.wait.mockResolvedValue(undefined);
  mocks.put.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
  mocks.settle.mockResolvedValue(undefined);
  mocks.update.mockImplementation(
    async (input: { from: string[]; values: Partial<VideoGeneration> }) => {
      if (!input.from.includes(row.status)) return null;
      row = { ...row, ...input.values };
      return row;
    },
  );
  mocks.start.mockResolvedValue({
    status: "running",
    jobId: "provider-job",
    requestId: "request-id",
  });
  mocks.check.mockResolvedValue({
    status: "succeeded",
    jobId: "provider-job",
    requestId: "request-id",
    output: { kind: "inline", bytes: Buffer.from("video") },
    usage: null,
  });
  mocks.inspect.mockResolvedValue({
    bytes: Buffer.from("muted-video"),
    metadata,
    warnings: [],
  });
});
describe("durable video lifecycle with mocked providers and storage", () => {
  it("shows actionable Google capacity feedback and retains uncertain charges without resubmission", async () => {
    mocks.check.mockResolvedValue({
      status: "failed",
      jobId: "provider-job",
      requestId: "request-id",
      code: "google_resource_exhausted",
      safeMessage: "Provider capacity unavailable",
    });
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "requires_reconciliation",
      code: "google_resource_exhausted",
    });
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          safeErrorMessage: expect.stringContaining("RESOURCE_EXHAUSTED"),
        }),
      }),
    );
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("claims one submission, persists its handle before polling, inspects and saves privately", async () => {
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "succeeded",
    });
    expect(mocks.start).toHaveBeenCalledTimes(1);
    const calls = mocks.update.mock.calls;
    expect(calls[0]![0].values).toMatchObject({
      status: "submitting",
      attemptCount: 1,
    });
    expect(calls[1]![0].values).toMatchObject({
      providerJobId: "provider-job",
      status: "running",
    });
    expect(mocks.update.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.wait.mock.invocationCallOrder[0]!,
    );
    expect(mocks.inspect).toHaveBeenCalledWith(
      expect.objectContaining({ mute: true, maximumDurationSeconds: 4 }),
    );
    expect(mocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: expect.stringMatching(
          /^workspaces\/.+\/media\/.+\/generated.mp4$/,
        ),
      }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ metadata, actualCostCents: null }),
    );
    expect(mocks.settle).not.toHaveBeenCalled(); // Missing provider accounting is not invented.
  });
  it("resumes a persisted provider job without another billable POST", async () => {
    row = {
      ...row,
      status: "running",
      providerJobId: "existing-job",
      attemptCount: 1,
    };
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "succeeded",
    });
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.check).toHaveBeenCalledWith("existing-job");
  });
  it("does not resubmit or refund ambiguous creation, including on a worker retry", async () => {
    mocks.start.mockRejectedValue(
      new VideoProviderError("provider_connection_uncertain", false),
    );
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "requires_reconciliation",
    });
    expect(row.status).toBe("requires_reconciliation");
    expect(row.providerJobId).toBeNull();
    await runVideoGeneration(scope, mocks.wait);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("never refunds an accepted job merely because a later poll loses authorization", async () => {
    row = {
      ...row,
      status: "running",
      providerJobId: "existing-job",
      attemptCount: 1,
    };
    mocks.check.mockRejectedValue(
      new VideoProviderError("provider_http_403", true),
    );
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "requires_reconciliation",
    });
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("releases only a definitely unbilled authentication rejection", async () => {
    mocks.start.mockRejectedValue(
      new VideoProviderError("provider_http_403", true),
    );
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "failed",
    });
    expect(mocks.settle).toHaveBeenCalledWith({ ...scope, actualCostCents: 0 });
  });
  it("checks current membership before spending, and honors a lost claim", async () => {
    mocks.member.mockResolvedValue(null);
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "failed",
    });
    expect(mocks.start).not.toHaveBeenCalled();
    row = job();
    mocks.member.mockResolvedValue({ role: "owner" });
    mocks.update.mockResolvedValue(null);
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "claimed_elsewhere",
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("never creates a usable library asset when inspection fails", async () => {
    mocks.inspect.mockRejectedValue(new Error("invalid media"));
    expect(await runVideoGeneration(scope, mocks.wait)).toMatchObject({
      status: "requires_reconciliation",
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(row.providerJobId).toBe("provider-job");
  });
  it("reconciles measured tokens once an actual rate is pinned", async () => {
    row.pricingSnapshot = {
      ...row.pricingSnapshot,
      tokenPricing: {
        inputUsdPerMillion: 1.5,
        textUsdPerMillion: 9,
        videoUsdPerMillion: 17.5,
      },
    };
    mocks.check.mockResolvedValue({
      status: "succeeded",
      jobId: "provider-job",
      requestId: "request-id",
      output: { kind: "inline", bytes: Buffer.from("video") },
      usage: {
        inputTokens: 100,
        outputTokens: 5000,
        videoTokens: 4900,
        thoughtTokens: 10,
      },
    });
    await runVideoGeneration(scope, mocks.wait);
    expect(mocks.settle).toHaveBeenCalledWith({ ...scope, actualCostCents: 9 });
  });
  it("refreshes late billing on the existing completed handle without regenerating media", async () => {
    row = {
      ...row,
      status: "succeeded",
      providerJobId: "completed-job",
      actualCostCents: null,
      pricingSnapshot: { ...row.pricingSnapshot, creditUsdMicros: 3000 },
    };
    mocks.check.mockResolvedValue({
      status: "succeeded",
      jobId: "completed-job",
      requestId: "completed-job",
      output: { kind: "uri", uri: "https://cdn.example/expired.mp4" },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        videoTokens: 0,
        thoughtTokens: 0,
        creditsCharged: 20,
      },
    });
    await runVideoGeneration(scope, mocks.wait);
    expect(mocks.check).toHaveBeenCalledWith("completed-job");
    expect(mocks.settle).toHaveBeenCalledWith({ ...scope, actualCostCents: 6 });
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
