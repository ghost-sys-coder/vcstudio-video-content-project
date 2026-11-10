import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { mcpIds, mcpOperationFixture } from "@/lib/test-utils/mcp-fixtures";
import type { McpOperation } from "@/db/repositories/mcp.repository";
import type { StandaloneGenerationPlan } from "./standalone-generation-plan";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  find: vi.fn(),
  claim: vi.fn(),
  update: vi.fn(),
  access: vi.fn(),
  build: vi.fn(),
  image: vi.fn(),
  speak: vi.fn(),
  inspect: vi.fn(),
  put: vi.fn(),
  complete: vi.fn(),
  settle: vi.fn(),
  refs: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  findMcpOperation: m.find,
  updateMcpOperation: m.update,
}));
vi.mock("@/db/repositories/mcp-generation.repository", () => ({
  claimMcpStandaloneGeneration: m.claim,
}));
vi.mock("@/db/commands/mcp-generated-asset", () => ({
  completeMcpGeneratedAsset: m.complete,
}));
vi.mock("@/db/commands/mcp-generation-commands", () => ({
  settleMcpGeneration: m.settle,
}));
vi.mock("./generation-service", () => ({
  assertMcpGenerationWorkerAccess: m.access,
}));
vi.mock("./standalone-generation-plan", async (original) => ({
  ...(await original<typeof import("./standalone-generation-plan")>()),
  buildStandaloneGenerationPlan: m.build,
}));
vi.mock("@/lib/openai/openai-image-generation-provider", () => ({
  OpenAiImageGenerationProvider: class {
    generate = m.image;
  },
}));
vi.mock("@/lib/speech/create-speech-provider", () => ({
  createSpeechProvider: () => ({ synthesize: m.speak }),
}));
vi.mock("@/lib/media/inspect-media-file", () => ({
  inspectMediaFile: m.inspect,
}));
vi.mock("@/lib/storage/media-asset-storage", () => ({
  putGeneratedMediaAsset: m.put,
}));
vi.mock("@/lib/storage/scene-image-storage", () => ({
  downloadSceneImageReferences: m.refs,
}));
vi.mock("@/lib/rate-limit/enforce-rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: m.audit,
}));
vi.mock("@/lib/env/server", () => ({
  getSceneImageEnvironment: () => ({
    OPENAI_API_KEY: "test-only-fake",
    OPENAI_REQUEST_TIMEOUT_SECONDS: 5,
    MAX_REFERENCE_BYTES_PER_GENERATION: 10_000_000,
  }),
  getSceneAudioEnvironment: () => ({
    FFMPEG_PATH: "mock-ffmpeg",
    FFPROBE_PATH: "mock-ffprobe",
  }),
  getSceneMediaUploadEnvironment: () => ({
    MAX_SCENE_AUDIO_UPLOAD_SIZE_BYTES: 10_000_000,
  }),
  getMediaLibraryEnvironment: () => ({ MAX_MEDIA_IMAGE_BYTES: 10_000_000 }),
}));
import { runStandaloneMcpGeneration } from "./run-standalone-generation";
import { fingerprint } from "./fingerprint";
const input = { workspaceId: mcpIds.workspace, operationId: mcpIds.operation };
let op: McpOperation, plan: StandaloneGenerationPlan;
beforeEach(async () => {
  vi.clearAllMocks();
  plan = {
    kind: "image",
    estimatedCostCents: 8,
    promptTemplateVersion: "standalone-image-v1",
    configuration: {
      model: "test-image",
      prompt: "Business illustration",
      quality: "low",
      size: "1024x1024",
      outputFormat: "png",
      outputCompression: 100,
      background: "opaque",
    },
    references: [],
    rates: {
      textInputCostPerMillionCents: 1,
      imageInputCostPerMillionCents: 1,
      outputCostPerMillionCents: 1,
    },
  };
  op = mcpOperationFixture({
    kind: "generate_media",
    status: "queued",
    input: {
      request: {
        kind: "image",
        title: "Business illustration",
        prompt: "Business illustration",
        size: "1024x1024",
        quality: "low",
        maximumCostCents: 20,
      },
      plan,
      planHash: fingerprint(plan),
    },
  });
  m.find.mockImplementation(async () => op);
  m.claim.mockImplementation(async () => {
    if (op.status !== "queued") return null;
    op = { ...op, status: "running" };
    return op;
  });
  m.update.mockImplementation(async ({ values }) => {
    op = { ...op, ...values };
    return op;
  });
  m.access.mockResolvedValue(op);
  m.build.mockImplementation(async () => plan);
  m.refs.mockResolvedValue([]);
  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "#008060" },
  })
    .png()
    .toBuffer();
  m.image.mockResolvedValue({
    bytes: png,
    mimeType: "image/png",
    requestId: "provider-image-1",
    usage: null,
  });
  m.complete.mockImplementation(async () => {
    op = { ...op, status: "succeeded" };
  });
});
describe("standalone MCP generation worker", () => {
  it("decodes the generated image, stores a private library asset and settles once", async () => {
    expect(await runStandaloneMcpGeneration(input)).toEqual({
      status: "succeeded",
      mediaAssetId: input.operationId,
    });
    expect(m.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "image",
        width: 4,
        height: 4,
        contentType: "image/png",
        result: expect.objectContaining({
          providerRequestId: "provider-image-1",
          actualCostCents: 8,
        }),
      }),
    );
    expect(m.put).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: `workspaces/${input.workspaceId}/library/${input.operationId}.png`,
      }),
    );
    expect(m.settle).toHaveBeenCalledWith(
      input.workspaceId,
      input.operationId,
      8,
    );
    await runStandaloneMcpGeneration(input);
    expect(m.image).toHaveBeenCalledTimes(1);
    expect(m.settle).toHaveBeenCalledTimes(1);
  });
  it("does not regenerate after an ambiguous paid response", async () => {
    m.image.mockRejectedValue(
      new Error("connection ended with private details"),
    );
    expect(await runStandaloneMcpGeneration(input)).toEqual({
      status: "failed",
    });
    expect(op.error).not.toContain("private details");
    expect(op.result).toMatchObject({
      providerSubmitted: true,
      actualCostCents: 8,
    });
    expect(m.settle).toHaveBeenCalledWith(
      input.workspaceId,
      input.operationId,
      8,
    );
    expect(m.complete).not.toHaveBeenCalled();
    await runStandaloneMcpGeneration(input);
    expect(m.image).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed output without creating a usable asset, retaining the paid attempt", async () => {
    m.image.mockResolvedValue({
      bytes: Buffer.from("not an image"),
      mimeType: "image/png",
      requestId: "provider-2",
      usage: null,
    });
    await runStandaloneMcpGeneration(input);
    expect(op.status).toBe("failed");
    expect(m.complete).not.toHaveBeenCalled();
    expect(m.put).not.toHaveBeenCalled();
    expect(m.settle).toHaveBeenCalledWith(
      input.workspaceId,
      input.operationId,
      8,
    );
  });
  it("releases the reservation if authority was revoked before provider submission", async () => {
    m.access.mockRejectedValue(new Error("revoked"));
    await runStandaloneMcpGeneration(input);
    expect(m.image).not.toHaveBeenCalled();
    expect(m.settle).toHaveBeenCalledWith(
      input.workspaceId,
      input.operationId,
      0,
    );
  });
  it("rejects changed provider/reference plans before spending", async () => {
    m.build.mockResolvedValue({ ...plan, estimatedCostCents: 9 });
    await runStandaloneMcpGeneration(input);
    expect(m.image).not.toHaveBeenCalled();
    expect(m.settle).toHaveBeenCalledWith(
      input.workspaceId,
      input.operationId,
      0,
    );
  });
  it("generates, inspects and stores narration without creating a project", async () => {
    plan = {
      kind: "audio",
      segmentCount: 1,
      estimatedCostCents: 2,
      promptTemplateVersion: "voice-preset-v1",
      text: "A useful business update.",
      provider: "openai",
      model: "test-tts",
      voice: "alloy",
      format: "mp3",
      speedScaledPercent: 100,
      instructions: "Calm",
      language: "en-US",
      voicePresetId: mcpIds.asset,
      voiceRevision: new Date().toISOString(),
      rates: { costPerMillionCharactersCents: 1500, minimumEstimateCents: 1 },
    };
    op.input = {
      request: {
        kind: "audio",
        title: "Narration",
        text: plan.text,
        voicePresetId: mcpIds.asset,
        maximumCostCents: 5,
      },
      plan,
      planHash: fingerprint(plan),
    };
    m.speak.mockResolvedValue({
      bytes: Buffer.from("mock-audio"),
      contentType: "audio/mpeg",
      requestId: "speech-1",
      characterCount: plan.text.length,
    });
    m.inspect.mockResolvedValue({
      metadata: {
        kind: "audio",
        durationMilliseconds: 2000,
        container: "mp3",
        codec: "mp3",
        channels: 1,
        sampleRate: 24000,
        silenceRatio: 0,
        clippingRatio: 0,
      },
      warnings: [],
      amplitudeEnvelope: [],
    });
    await runStandaloneMcpGeneration(input);
    expect(m.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: plan.text,
        voice: { kind: "built_in", name: "alloy" },
      }),
    );
    expect(m.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "audio",
        durationMilliseconds: 2000,
        verifiedMetadata: expect.objectContaining({ codec: "mp3" }),
      }),
    );
    expect(m.image).not.toHaveBeenCalled();
  });
});
