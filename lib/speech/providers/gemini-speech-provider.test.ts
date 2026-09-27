import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { GeminiSpeechProvider } from "@/lib/speech/providers/gemini-speech-provider";
import { SpeechProviderUnsupportedError } from "@/lib/speech/speech-provider";
import { GEMINI_CONSENT_PHRASE } from "@/lib/speech/voice-cloning-capability";

function audioResponse(base64 = Buffer.from("RIFFfake").toString("base64")) {
  return new Response(
    JSON.stringify({ steps: [{ content: [{ data: base64 }] }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function provider(fetcher: typeof fetch) {
  return new GeminiSpeechProvider({
    apiKey: "test-key",
    model: "gemini-3.8-flash-tts",
    fetcher,
  });
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    text: "Inflation is quietly reshaping your savings.",
    voice: { kind: "enrolled" as const, providerVoiceId: "voice_abc123" },
    format: "wav" as const,
    speedScaledPercent: 100,
    language: "en-US",
    ...overrides,
  };
}

function body(fetcher: ReturnType<typeof vi.fn>) {
  const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("GeminiSpeechProvider", () => {
  it("enrols voices rather than cloning on every request", () => {
    const capability = provider(vi.fn() as unknown as typeof fetch).capability;
    expect(capability.kind).toBe("enrolled");
    if (capability.kind !== "enrolled") return;
    expect(capability.requiresConsentRecording).toBe(true);
    // Google checks the wording, so it has to be Google's wording.
    expect(capability.consentPhrase).toBe(GEMINI_CONSENT_PHRASE);
    expect(capability.consentPhrase).toContain("Google");
  });

  it("asks for a sample in the range Google documents", () => {
    const capability = provider(vi.fn() as unknown as typeof fetch).capability;
    if (capability.kind !== "enrolled") throw new Error("expected enrolled");
    expect(capability.sample.minimumSeconds).toBe(10);
    expect(capability.sample.maximumSeconds).toBe(30);
  });

  it("names a replicated voice by identifier and sends no audio", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    await provider(fetcher as unknown as typeof fetch).synthesize(request());

    const sent = body(fetcher);
    expect(sent.model).toBe("gemini-3.8-flash-tts");
    expect(sent.generation_config).toEqual({
      speech_config: [{ voice: "voice_abc123" }],
    });
    // A replicated voice travels as a reference; the recordings stay put.
    expect(JSON.stringify(sent)).not.toContain("source_audio");
  });

  it("asks for a complete WAV rather than a stream", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    await provider(fetcher as unknown as typeof fetch).synthesize(request());
    const sent = body(fetcher);
    expect(sent.response_format).toMatchObject({
      type: "audio",
      mime_type: "audio/wav",
    });
    expect(sent.stream).toBe(false);
  });

  it("sends the API key in Google's header, not a bearer token", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    await provider(fetcher as unknown as typeof fetch).synthesize(request());
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-key" });
  });

  it("carries delivery direction with the line", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    await provider(fetcher as unknown as typeof fetch).synthesize(
      request({ instructions: "Warm and unhurried" }),
    );
    expect(JSON.stringify(body(fetcher))).toContain("Warm and unhurried");
  });

  it("decodes the returned audio", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    const result = await provider(
      fetcher as unknown as typeof fetch,
    ).synthesize(request());
    expect(result.provider).toBe("gemini");
    expect(result.bytes.toString()).toBe("RIFFfake");
    expect(result.contentType).toBe("audio/wav");
  });

  // Every Gemini clip is watermarked, and a replicated one carries provenance
  // credentials. Recording that keeps a finished asset's origin traceable.
  it("records that the audio is watermarked", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    const result = await provider(
      fetcher as unknown as typeof fetch,
    ).synthesize(request());
    expect(result.safeMetadata.watermarked).toBe(true);
    expect(result.safeMetadata.cloned).toBe(true);
  });

  it("refuses a format it cannot produce rather than mislabelling bytes", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    await expect(
      provider(fetcher as unknown as typeof fetch).synthesize(
        request({ format: "mp3" }),
      ),
    ).rejects.toBeInstanceOf(SpeechProviderUnsupportedError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a reference clip, which this provider never takes per request", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    await expect(
      provider(fetcher as unknown as typeof fetch).synthesize(
        request({
          voice: {
            kind: "zero_shot",
            reference: { bytes: Buffer.from("x"), contentType: "audio/wav" },
          },
        }),
      ),
    ).rejects.toBeInstanceOf(SpeechProviderUnsupportedError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a speed change rather than silently ignoring it", async () => {
    const fetcher = vi.fn(async () => audioResponse());
    await expect(
      provider(fetcher as unknown as typeof fetch).synthesize(
        request({ speedScaledPercent: 130 }),
      ),
    ).rejects.toBeInstanceOf(SpeechProviderUnsupportedError);
  });

  it("explains a rejected key without leaking the body", async () => {
    const fetcher = vi.fn(
      async () => new Response("key sk-secret rejected", { status: 403 }),
    );
    const error = await provider(fetcher as unknown as typeof fetch)
      .synthesize(request())
      .catch((caught: unknown) => caught);
    expect((error as Error).message).toMatch(/key was rejected/i);
    expect((error as Error).message).not.toContain("sk-secret");
  });

  it("treats a response with no audio as a failure", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ steps: [] }), { status: 200 }),
    );
    await expect(
      provider(fetcher as unknown as typeof fetch).synthesize(request()),
    ).rejects.toThrow(/no audio/i);
  });

  it("refuses to be built without a key", () => {
    expect(
      () =>
        new GeminiSpeechProvider({
          apiKey: "  ",
          model: "gemini-3.8-flash-tts",
        }),
    ).toThrow(RangeError);
  });
});
