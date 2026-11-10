import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  start: vi.fn(),
  get: vi.fn(),
  download: vi.fn(),
}));
vi.mock("./client", async (original) => ({
  ...(await original<typeof import("./client")>()),
  startElevenLabsMedia: m.start,
  getElevenLabsMedia: m.get,
}));
vi.mock("@/lib/mcp/safe-download", () => ({ withPublicDownload: m.download }));
import { ElevenLabsImageProvider } from "./image-provider";
import { ElevenLabsVideoProvider } from "./video-provider";
import { classifyImageGenerationError } from "@/lib/openai/image-generation-error";
import { VIDEO_MODELS } from "@/lib/video-generation/video-model-catalog";
import { videoGenerationRequestSchema } from "@studio/contracts/video";
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    ENABLE_ELEVENLABS: "true",
    ELEVEN_LABS_API_KEY: "fake",
    ELEVENLABS_INTERNAL_DEPLOYMENT: "true",
    ENABLE_PRIVATE_ACCESS: "true",
    ELEVENLABS_VISUALS_ENABLED: "true",
  }))
    vi.stubEnv(key, value);
  m.start.mockResolvedValue({ id: "remote-job", status: "pending" });
});
afterEach(() => vi.unstubAllEnvs());
const imageInput = {
  model: "elevenlabs/gpt-image-1.5",
  prompt: "A useful portrait.",
  quality: "low" as const,
  size: "1024x1536" as const,
  background: "opaque" as const,
  outputFormat: "png" as const,
  outputCompression: 90,
  references: [],
};
describe("ElevenLabs async image ownership and billing", () => {
  it("resumes an already-owned async handle without another POST", async () => {
    const accepted = vi.fn();
    m.get.mockResolvedValue({
      id: "existing-job",
      status: "failed",
      failure_reason: "moderated",
    });
    await expect(
      new ElevenLabsImageProvider(
        accepted,
        async () => {},
        "existing-job",
      ).generate(imageInput),
    ).rejects.toMatchObject({
      jobId: "existing-job",
      definitelyUnbilled: true,
    });
    expect(m.start).not.toHaveBeenCalled();
    expect(accepted).not.toHaveBeenCalled();
    expect(m.get).toHaveBeenCalledWith("image", "existing-job");
  });
  it("persists the handle before polling, decodes the output and never leaks a download URL", async () => {
    const accepted = vi.fn();
    const bytes = await sharp({
      create: { width: 16, height: 24, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    m.get.mockImplementation(async () => {
      expect(accepted).toHaveBeenCalledWith("remote-job");
      return {
        id: "remote-job",
        status: "completed",
        content_url: "https://storage.example/private-token",
        content_mime_type: "image/png",
      };
    });
    m.download.mockImplementation(async (_url, consume) =>
      consume({ contentLength: bytes.length, body: [bytes] }),
    );
    const result = await new ElevenLabsImageProvider(accepted).generate(
      imageInput,
    );
    expect(m.start).toHaveBeenCalledWith(
      "image",
      expect.objectContaining({
        aspect_ratio: "2:3",
        model_id: "gpt-image-1.5",
      }),
    );
    expect(result).toMatchObject({
      provider: "elevenlabs",
      requestId: "remote-job",
      width: 16,
      height: 24,
      usage: null,
    });
    expect(JSON.stringify(result)).not.toContain("private-token");
  });
  it("retains the remote ID and refuses paid retry when persisting the handle fails", async () => {
    const provider = new ElevenLabsImageProvider(async () => {
      throw new Error("db failure");
    });
    const failure = await provider
      .generate(imageInput)
      .catch((e) => classifyImageGenerationError(e));
    expect(failure).toMatchObject({
      retriable: false,
      providerMayHaveAcceptedRequest: true,
      requestId: "remote-job",
    });
    expect(m.start).toHaveBeenCalledTimes(1);
    expect(m.get).not.toHaveBeenCalled();
  });
  it("releases a provider-reported failed image and never retries", async () => {
    m.get.mockResolvedValue({
      id: "remote-job",
      status: "failed",
      failure_reason: "moderated",
    });
    const failure = await new ElevenLabsImageProvider(async () => {})
      .generate(imageInput)
      .catch((e) => classifyImageGenerationError(e));
    expect(failure).toMatchObject({
      retriable: false,
      providerMayHaveAcceptedRequest: false,
    });
    expect(m.start).toHaveBeenCalledTimes(1);
  });
  it("refuses excess references before submitting", async () => {
    await expect(
      new ElevenLabsImageProvider(async () => {}).generate({
        ...imageInput,
        references: Array.from({ length: 6 }, () => ({
          assetId: "id",
          bytes: Buffer.from("x"),
          mimeType: "image/png" as const,
        })),
      }),
    ).rejects.toThrow(/five/);
    expect(m.start).not.toHaveBeenCalled();
  });
});
describe("ElevenLabs video adapter", () => {
  it("maps first/last frames and optional native audio through the documented API", async () => {
    const model = VIDEO_MODELS.find(
      (v) => v.id === "elevenlabs-veo-3.1-fast-generate-001",
    )!;
    const request = videoGenerationRequestSchema.parse({
      modelId: model.id,
      title: "Clip",
      prompt: "A moving scene.",
      mode: "image_to_video",
      aspectRatio: "16:9",
      resolution: "720p",
      durationSeconds: 8,
      audio: "native",
      target: { kind: "direct" },
      inputs: [
        {
          assetId: "11111111-1111-4111-8111-111111111111",
          role: "first_frame",
          source: "library",
        },
      ],
    });
    const provider = new ElevenLabsVideoProvider();
    expect(
      await provider.start({
        request,
        model,
        finalPrompt: request.prompt,
        assets: [
          {
            role: "first_frame",
            contentType: "image/png",
            bytes: Buffer.from("image"),
          },
        ],
      }),
    ).toMatchObject({ status: "running", jobId: "remote-job" });
    expect(m.start).toHaveBeenCalledWith(
      "video",
      expect.objectContaining({
        generate_audio: true,
        duration_secs: 8,
        start_frame: {
          type: "inline_base64",
          content_base64: Buffer.from("image").toString("base64"),
          mime_type: "image/png",
        },
        enhance_prompt: false,
      }),
    );
    m.get.mockResolvedValue({
      id: "remote-job",
      status: "failed",
      failure_reason: "charging_failed",
    });
    expect(await provider.check("remote-job")).toMatchObject({
      status: "failed",
      definitelyUnbilled: true,
    });
  });
});
