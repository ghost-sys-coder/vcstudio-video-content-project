import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const speechEnvironment = vi.hoisted(() => ({
  SPEECH_PROVIDER: "gemini" as "gemini" | "openai" | "magpie",
  GOOGLE_GEMINI_API_KEY: "test-key" as string | undefined,
  GEMINI_TTS_MODEL: "gemini-3.8-flash-tts",
  GEMINI_REQUEST_TIMEOUT_SECONDS: 30,
}));

vi.mock("@/lib/env/server", () => ({
  getSpeechProviderEnvironment: () => speechEnvironment,
  getSceneAudioEnvironment: () => ({
    OPENAI_API_KEY: "openai-test-key",
    OPENAI_TTS_MODEL: "gpt-4o-mini-tts",
    OPENAI_TTS_FORMAT: "mp3",
  }),
}));

import { CustomVoiceProviderError } from "@/lib/domain/errors";
import { GEMINI_CONSENT_PHRASE } from "@/lib/speech/voice-cloning-capability";
import {
  configuredEnrollmentProviderId,
  createVoiceEnrollmentProvider,
} from "@/lib/speech/voice-enrollment-provider";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function wav(name: string) {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "audio/wav" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  speechEnvironment.SPEECH_PROVIDER = "gemini";
  speechEnvironment.GOOGLE_GEMINI_API_KEY = "test-key";
});

describe("configuredEnrollmentProviderId", () => {
  it("follows SPEECH_PROVIDER instead of defaulting to OpenAI", () => {
    expect(configuredEnrollmentProviderId()).toBe("gemini");
    speechEnvironment.SPEECH_PROVIDER = "openai";
    expect(configuredEnrollmentProviderId()).toBe("openai");
  });

  it("offers no enrolment for a zero-shot provider", () => {
    speechEnvironment.SPEECH_PROVIDER = "magpie";
    expect(configuredEnrollmentProviderId()).toBeNull();
  });
});

describe("Gemini enrolment", () => {
  it("asks for Google's consent sentence, its sample bounds and WAV", () => {
    const provider = createVoiceEnrollmentProvider("gemini");
    expect(provider?.details).toEqual({
      provider: "gemini",
      consentPhrase: GEMINI_CONSENT_PHRASE,
      sample: { minimumSeconds: 10, maximumSeconds: 30 },
      recordingFormat: "wav",
    });
    expect(provider?.preset).toEqual({
      model: "gemini-3.8-flash-tts",
      format: "wav",
    });
  });

  it("is absent without a key rather than failing at request time", () => {
    speechEnvironment.GOOGLE_GEMINI_API_KEY = undefined;
    expect(createVoiceEnrollmentProvider("gemini")).toBeNull();
  });

  it("enrols a voice with no separate consent id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ id: "voice_abc123" })),
    );
    const enrolled = await createVoiceEnrollmentProvider("gemini")?.enroll({
      name: "Narrator",
      language: "en-US",
      consent: wav("consent.wav"),
      sample: wav("sample.wav"),
    });
    expect(enrolled).toEqual({
      providerVoiceId: "voice_abc123",
      providerConsentId: null,
    });
  });

  it("reports a refused recording as a recording failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: { message: "bad" } }, 400)),
    );
    const attempt = createVoiceEnrollmentProvider("gemini")?.enroll({
      name: "Narrator",
      language: "en-US",
      consent: wav("consent.wav"),
      sample: wav("sample.wav"),
    });
    await expect(attempt).rejects.toBeInstanceOf(CustomVoiceProviderError);
    await expect(attempt).rejects.toMatchObject({
      failure: "recording_rejected",
    });
  });

  it("reports a rejected key as unauthorized, and success as available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({}, 403)),
    );
    const provider = createVoiceEnrollmentProvider("gemini");
    expect((await provider?.checkAvailability())?.status).toBe("unauthorized");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ voices: [] })),
    );
    expect((await provider?.checkAvailability())?.status).toBe("available");
  });

  it("revokes by deleting the stored voice", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await createVoiceEnrollmentProvider("gemini")?.revoke({
      providerVoiceId: "voice_abc123",
      providerConsentId: null,
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/voices\/voice_abc123$/);
    expect(init.method).toBe("DELETE");
  });
});

describe("createVoiceEnrollmentProvider", () => {
  it("knows nothing of a provider it cannot revoke through", () => {
    expect(createVoiceEnrollmentProvider("magpie")).toBeNull();
  });
});
