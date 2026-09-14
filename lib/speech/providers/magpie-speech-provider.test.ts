import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { MagpieSpeechProvider } from "@/lib/speech/providers/magpie-speech-provider";
import { SpeechProviderUnsupportedError } from "@/lib/speech/speech-provider";
import type {
  MagpieSynthesisCall,
  MagpieTransport,
} from "@/lib/speech/providers/magpie-transport";

const calls: MagpieSynthesisCall[] = [];

const transport: MagpieTransport = {
  synthesize: async (call) => {
    calls.push(call);
    return { bytes: Buffer.from("RIFFfake"), requestId: "req-1" };
  },
};

function provider(overrides: Partial<MagpieSynthesisCall> = {}) {
  void overrides;
  return new MagpieSpeechProvider({
    transport,
    model: "magpie-tts-zeroshot",
    promptQuality: 20,
    sampleRateHz: 22_050,
  });
}

const reference = {
  bytes: Buffer.from("wav-bytes"),
  contentType: "audio/wav",
};

function request(overrides: Record<string, unknown> = {}) {
  return {
    text: "Inflation is quietly reshaping your savings.",
    voice: { kind: "zero_shot" as const, reference },
    format: "wav" as const,
    speedScaledPercent: 100,
    language: "en-US",
    ...overrides,
  };
}

describe("MagpieSpeechProvider", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("declares itself a zero-shot cloner, so callers stop looking for enrolment", () => {
    expect(provider().capability.kind).toBe("zero_shot");
  });

  it("sends the reference clip with the request, because nothing is stored", () => {
    return provider()
      .synthesize(request())
      .then(() => {
        expect(calls[0]?.audioPrompt?.bytes).toEqual(reference.bytes);
        expect(calls[0]?.language).toBe("en-US");
      });
  });

  it("reports the audio it actually received", async () => {
    const result = await provider().synthesize(request());
    expect(result.provider).toBe("magpie");
    expect(result.contentType).toBe("audio/wav");
    expect(result.format).toBe("wav");
    expect(result.requestId).toBe("req-1");
  });

  // The clip is somebody's voice. It must never reach a column or a log.
  it("keeps the reference recording out of its metadata", async () => {
    const result = await provider().synthesize(request());
    const serialized = JSON.stringify(result.safeMetadata);
    expect(serialized).not.toContain("wav-bytes");
    expect(result.safeMetadata.cloned).toBe(true);
  });

  // Answering in WAV to a request for mp3 would store mislabelled bytes and
  // hand the renderer a file it cannot play.
  it("refuses a format it cannot produce rather than mislabelling the bytes", async () => {
    await expect(
      provider().synthesize(request({ format: "mp3" })),
    ).rejects.toBeInstanceOf(SpeechProviderUnsupportedError);
    expect(calls).toHaveLength(0);
  });

  it("refuses narration longer than the endpoint accepts, before spending a call", async () => {
    await expect(
      provider().synthesize(request({ text: "a".repeat(2_001) })),
    ).rejects.toBeInstanceOf(SpeechProviderUnsupportedError);
    expect(calls).toHaveLength(0);
  });

  it("accepts narration exactly at the limit", async () => {
    await provider().synthesize(request({ text: "a".repeat(2_000) }));
    expect(calls).toHaveLength(1);
  });

  // Accepting a speed it ignores would leave a creator adjusting a dead control
  // and wondering why nothing changed.
  it("refuses a speed change rather than silently ignoring it", async () => {
    await expect(
      provider().synthesize(request({ speedScaledPercent: 120 })),
    ).rejects.toBeInstanceOf(SpeechProviderUnsupportedError);
  });

  it("refuses an enrolled voice identifier, which means nothing here", async () => {
    await expect(
      provider().synthesize(
        request({ voice: { kind: "enrolled", providerVoiceId: "voice_123" } }),
      ),
    ).rejects.toBeInstanceOf(SpeechProviderUnsupportedError);
  });

  it("still serves a catalogue voice with no reference clip", async () => {
    await provider().synthesize(
      request({
        voice: {
          kind: "built_in",
          name: "Magpie-ZeroShot-Multilingual.Female",
        },
      }),
    );
    expect(calls[0]?.voice).toBe("Magpie-ZeroShot-Multilingual.Female");
    expect(calls[0]?.audioPrompt).toBeUndefined();
  });

  it("rejects empty narration without calling the provider", async () => {
    await expect(
      provider().synthesize(request({ text: "   " })),
    ).rejects.toBeInstanceOf(RangeError);
    expect(calls).toHaveLength(0);
  });
});
