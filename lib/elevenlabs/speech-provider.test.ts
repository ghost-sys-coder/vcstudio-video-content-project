import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  convert: vi.fn(),
  response: vi.fn(),
  construct: vi.fn(),
}));
vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    constructor(options: unknown) {
      mocks.construct(options);
    }
    textToSpeech = { convert: mocks.convert };
  },
  ElevenLabsError: class extends Error {
    statusCode = 401;
  },
}));
import { ElevenLabsSpeechProvider } from "./speech-provider";
import type { SpeechSynthesisRequest } from "@/lib/speech/speech-provider";
const request: SpeechSynthesisRequest = {
  text: "A real narration.",
  voice: { kind: "built_in", name: "ownedVoice1234567890" },
  format: "mp3",
  speedScaledPercent: 100,
  language: "en-US",
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    ENABLE_ELEVENLABS: "true",
    ELEVEN_LABS_API_KEY: "fake-private-key",
    ELEVENLABS_INTERNAL_DEPLOYMENT: "true",
    ENABLE_PRIVATE_ACCESS: "true",
    ELEVENLABS_USAGE_MODE: "internal",
  }))
    vi.stubEnv(key, value);
  mocks.convert.mockReturnValue({ withRawResponse: mocks.response });
  mocks.response.mockImplementation(async () => ({
    data: new ReadableStream({
      start(c) {
        c.enqueue(Buffer.from([0, 1, 2, 3]));
        c.close();
      },
    }),
    rawResponse: new Response(null, {
      headers: { "request-id": "tts-operation", "x-character-count": "19" },
    }),
  }));
});
afterEach(() => vi.unstubAllEnvs());
describe("ElevenLabs narration adapter", () => {
  it("uses account voice IDs, pinned model and zero automatic retries", async () => {
    const result = await new ElevenLabsSpeechProvider().synthesize(request);
    expect(mocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 0 }),
    );
    expect(mocks.convert).toHaveBeenCalledWith(
      "ownedVoice1234567890",
      expect.objectContaining({
        modelId: "eleven_multilingual_v2",
        text: request.text,
        outputFormat: "mp3_44100_128",
      }),
      { maxRetries: 0 },
    );
    expect(result).toMatchObject({
      provider: "elevenlabs",
      characterCount: 19,
      requestId: "tts-operation",
      contentType: "audio/mpeg",
    });
    expect(JSON.stringify(result.safeMetadata)).not.toContain(
      "fake-private-key",
    );
  });
  it("wraps raw PCM in a correct 24 kHz mono WAV", async () => {
    const result = await new ElevenLabsSpeechProvider().synthesize({
      ...request,
      format: "wav",
    });
    expect(result.bytes.toString("ascii", 0, 4)).toBe("RIFF");
    expect(result.bytes.readUInt32LE(24)).toBe(24000);
    expect(result.bytes.readUInt32LE(40)).toBe(4);
  });
  it("checks the master switch for each synthesis on an existing instance", async () => {
    const provider = new ElevenLabsSpeechProvider();
    vi.stubEnv("ENABLE_ELEVENLABS", "false");
    await expect(provider.synthesize(request)).rejects.toThrow(/switched off/);
    expect(mocks.convert).not.toHaveBeenCalled();
  });
  it("rejects unsupported formats, cloning, speeds and oversized input before spending", async () => {
    const provider = new ElevenLabsSpeechProvider();
    for (const value of [
      { ...request, format: "aac" as const },
      { ...request, speedScaledPercent: 140 },
      { ...request, text: "a".repeat(4001) },
      {
        ...request,
        voice: { kind: "enrolled" as const, providerVoiceId: "voice" },
      },
    ])
      await expect(provider.synthesize(value)).rejects.toThrow();
    expect(mocks.convert).not.toHaveBeenCalled();
  });
  it("redacts provider failures and never retries the paid request", async () => {
    mocks.response.mockRejectedValue(new Error("secret raw response"));
    await expect(
      new ElevenLabsSpeechProvider().synthesize(request),
    ).rejects.toThrow(/Inspect this operation/);
    expect(mocks.convert).toHaveBeenCalledTimes(1);
  });
});
