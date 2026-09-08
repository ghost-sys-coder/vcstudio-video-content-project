import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { OpenAiCustomVoiceProvider } from "@/lib/openai/custom-voice-provider";
import { CustomVoiceProviderError } from "@/lib/domain/errors";

describe("OpenAiCustomVoiceProvider", () => {
  it("creates consent and a voice with the documented multipart fields", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "cons_123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "voice_123" }), { status: 200 }),
      );
    const provider = new OpenAiCustomVoiceProvider({ apiKey: "test", fetcher });
    const recording = new File(["audio"], "recording.webm", {
      type: "audio/webm",
    });

    const consentId = await provider.createConsent({
      name: "Owner consent",
      language: "en-US",
      recording,
    });
    const voiceId = await provider.createVoice({
      name: "My voice",
      consentId,
      sample: recording,
    });

    expect(consentId).toBe("cons_123");
    expect(voiceId).toBe("voice_123");
    const consentBody = fetcher.mock.calls[0]?.[1]?.body;
    const voiceBody = fetcher.mock.calls[1]?.[1]?.body;
    expect(consentBody).toBeInstanceOf(FormData);
    expect((consentBody as FormData).get("language")).toBe("en-US");
    expect((voiceBody as FormData).get("consent")).toBe("cons_123");
    expect((voiceBody as FormData).get("audio_sample")).toBeInstanceOf(File);
  });

  it("deletes provider consent during revocation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const provider = new OpenAiCustomVoiceProvider({ apiKey: "test", fetcher });
    await provider.deleteConsent("cons_123");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/voice_consents/cons_123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("separates an organization without access from an unknown route", async () => {
    // Both are 404; only the body text distinguishes them, and they call for
    // different operator action.
    // A fresh Response per call: a body may only be read once, and this test
    // makes two requests.
    const deniedFetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message:
                "Your organization does not have access to this endpoint.",
            },
          }),
          { status: 404 },
        ),
    );
    const denied = new OpenAiCustomVoiceProvider({
      apiKey: "test",
      fetcher: deniedFetcher,
    });
    await expect(denied.checkAvailability()).resolves.toMatchObject({
      status: "not_enabled",
    });
    await expect(
      denied.createConsent({
        name: "Owner consent",
        language: "en-US",
        recording: new File(["audio"], "r.webm", { type: "audio/webm" }),
      }),
    ).rejects.toMatchObject({ failure: "provider_not_enabled" });
  });

  it("treats a 400 from the availability probe as proof of access", async () => {
    // An allowlisted organization answers the empty probe with a validation
    // error, which is the only positive signal available without enrolling.
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "Missing required parameter." } }),
          { status: 400 },
        ),
      );
    const provider = new OpenAiCustomVoiceProvider({ apiKey: "test", fetcher });
    await expect(provider.checkAvailability()).resolves.toMatchObject({
      status: "available",
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api.openai.com/v1/audio/voice_consents",
    );
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe("POST");
  });

  it("reports a missing endpoint as unsupported rather than a bad recording", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ error: { message: "Endpoint not found." } }),
            { status: 404 },
          ),
      );
    const provider = new OpenAiCustomVoiceProvider({ apiKey: "test", fetcher });

    await expect(provider.checkAvailability()).resolves.toMatchObject({
      status: "unsupported",
    });
    await expect(
      provider.createConsent({
        name: "Owner consent",
        language: "en-US",
        recording: new File(["audio"], "r.webm", { type: "audio/webm" }),
      }),
    ).rejects.toMatchObject({ failure: "provider_unavailable", status: 404 });
  });

  it("classifies a rejected recording and preserves the provider's reason", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "audio_sample is too short" } }),
          { status: 400, headers: { "x-request-id": "req_9" } },
        ),
      );
    const provider = new OpenAiCustomVoiceProvider({ apiKey: "test", fetcher });

    const error = await provider
      .createVoice({
        name: "My voice",
        consentId: "cons_1",
        sample: new File(["audio"], "r.webm", { type: "audio/webm" }),
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(CustomVoiceProviderError);
    expect(error).toMatchObject({
      failure: "recording_rejected",
      providerMessage: "audio_sample is too short",
      requestId: "req_9",
    });
  });

  it("treats a transport failure as a provider error, not a rejection", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network down"));
    const provider = new OpenAiCustomVoiceProvider({ apiKey: "test", fetcher });
    await expect(provider.checkAvailability()).resolves.toMatchObject({
      status: "unknown",
    });
    await expect(
      provider.createConsent({
        name: "n",
        language: "en-US",
        recording: new File(["a"], "r.webm", { type: "audio/webm" }),
      }),
    ).rejects.toMatchObject({ failure: "provider_error" });
  });

  it("confirms availability when the endpoint answers", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    const provider = new OpenAiCustomVoiceProvider({ apiKey: "test", fetcher });
    await expect(provider.checkAvailability()).resolves.toMatchObject({
      status: "available",
    });
  });
});
