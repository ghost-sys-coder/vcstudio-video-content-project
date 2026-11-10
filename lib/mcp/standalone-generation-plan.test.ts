import { beforeEach, describe, expect, it, vi } from "vitest";
import { mcpGenerationRequestSchema } from "@studio/contracts/mcp-generation";
import { mcpIds } from "@/lib/test-utils/mcp-fixtures";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  assets: vi.fn(),
  preset: vi.fn(),
  etag: vi.fn(),
  synthesize: vi.fn(),
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findReadyMediaAssets: m.assets,
}));
vi.mock("@/db/repositories/scene-audio.repository", () => ({
  findVoicePreset: m.preset,
}));
vi.mock("./storage-integrity", () => ({ mcpObjectEtag: m.etag }));
vi.mock("@/lib/speech/create-speech-provider", () => ({
  createSpeechProvider: () => ({
    maximumCharacters: 4096,
    synthesize: m.synthesize,
  }),
}));
vi.mock("@/lib/env/server", () => ({
  getSceneAudioEnvironment: () => ({
    ENABLE_SCENE_AUDIO_GENERATION: true,
    OPENAI_TTS_MODEL: "tts-test",
    MAX_NARRATION_CHARACTERS: 4096,
    OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS: 1500,
    OPENAI_TTS_MINIMUM_ESTIMATE_CENTS: 1,
  }),
  getSpeechProviderEnvironment: () => ({ GEMINI_TTS_MODEL: "gemini-test" }),
  getSceneImageEnvironment: () => ({
    ENABLE_SCENE_IMAGE_GENERATION: true,
    MAX_REFERENCE_ASSETS_PER_GENERATION: 4,
    MAX_REFERENCE_BYTES_PER_GENERATION: 1000,
    OPENAI_IMAGE_MODEL: "image-test",
    OPENAI_IMAGE_OUTPUT_FORMAT: "png",
    OPENAI_IMAGE_DRAFT_COMPRESSION: 70,
    OPENAI_IMAGE_FINAL_COMPRESSION: 100,
    OPENAI_IMAGE_BACKGROUND: "opaque",
    OPENAI_IMAGE_LOW_SQUARE_ESTIMATE_CENTS: 2,
    OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS: 500,
    OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS: 800,
    OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS: 3000,
    OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET: 1,
  }),
}));
import { buildStandaloneGenerationPlan } from "./standalone-generation-plan";
const preset = {
  id: mcpIds.asset,
  provider: "openai",
  model: "tts-test",
  customVoiceId: null,
  voice: "alloy",
  format: "mp3",
  instructions: "Calm narration",
  speedScaledPercent: 100,
  updatedAt: new Date(),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.assets.mockResolvedValue([]);
  m.preset.mockResolvedValue({ ...preset });
  m.etag.mockResolvedValue('"etag-one"');
});
function audio(text: string) {
  const request = mcpGenerationRequestSchema.parse({
    kind: "audio",
    text,
    voicePresetId: mcpIds.asset,
    maximumCostCents: 20,
  });
  if (request.kind !== "audio") throw new Error("wrong fixture");
  return request;
}
function image(referenceAssetIds: string[] = []) {
  const request = mcpGenerationRequestSchema.parse({
    kind: "image",
    prompt: "An original studio illustration",
    size: "1024x1024",
    quality: "low",
    referenceAssetIds,
    maximumCostCents: 20,
  });
  if (request.kind !== "image") throw new Error("wrong fixture");
  return request;
}
describe("standalone generation planning never spends", () => {
  it("quotes each pause-separated speech request instead of under-reserving one minimum charge", async () => {
    const plan = await buildStandaloneGenerationPlan(
      mcpIds.workspace,
      audio("First sentence. [PAUSE: 1s] Second sentence."),
    );
    expect(plan).toMatchObject({
      kind: "audio",
      segmentCount: 2,
      estimatedCostCents: 2,
      provider: "openai",
      model: "tts-test",
    });
    expect(m.synthesize).not.toHaveBeenCalled();
  });
  it("rejects excessive pause segmentation and oversized narration before any paid call", async () => {
    await expect(
      buildStandaloneGenerationPlan(
        mcpIds.workspace,
        audio("One. [PAUSE: 1s] ".repeat(5) + "Done."),
      ),
    ).rejects.toThrow("at most 4");
    await expect(
      buildStandaloneGenerationPlan(mcpIds.workspace, audio("a".repeat(4097))),
    ).rejects.toThrow("4096");
    expect(m.synthesize).not.toHaveBeenCalled();
  });
  it("refuses unsupported custom voices, raw formats and stale model presets", async () => {
    for (const change of [
      { customVoiceId: mcpIds.post },
      { format: "pcm" },
      { model: "old-model" },
    ]) {
      m.preset.mockResolvedValue({ ...preset, ...change });
      await expect(
        buildStandaloneGenerationPlan(mcpIds.workspace, audio("Narration")),
      ).rejects.toThrow();
    }
    expect(m.synthesize).not.toHaveBeenCalled();
  });
  it("keeps the exact independent image prompt and a versioned provider snapshot", async () => {
    expect(
      await buildStandaloneGenerationPlan(mcpIds.workspace, image()),
    ).toMatchObject({
      kind: "image",
      promptTemplateVersion: "standalone-image-v1",
      configuration: {
        model: "image-test",
        prompt: "An original studio illustration",
        size: "1024x1024",
        quality: "low",
      },
      estimatedCostCents: 3,
    });
  });
  it("does not accept a foreign or oversized reference even if a repository returns it", async () => {
    const ref = {
      id: mcpIds.asset,
      kind: "image",
      objectKey: "workspaces/foreign/library/image.png",
      contentType: "image/png",
      sizeBytes: 10,
    };
    m.assets.mockResolvedValue([ref]);
    await expect(
      buildStandaloneGenerationPlan(mcpIds.workspace, image([mcpIds.asset])),
    ).rejects.toThrow("this workspace");
    m.assets.mockResolvedValue([
      {
        ...ref,
        objectKey: `workspaces/${mcpIds.workspace}/library/image.png`,
        sizeBytes: 1001,
      },
    ]);
    await expect(
      buildStandaloneGenerationPlan(mcpIds.workspace, image([mcpIds.asset])),
    ).rejects.toThrow("size limit");
    expect(m.etag).not.toHaveBeenCalled();
  });
});
