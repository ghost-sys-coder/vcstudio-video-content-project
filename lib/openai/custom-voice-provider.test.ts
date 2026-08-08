import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { OpenAiCustomVoiceProvider } from "@/lib/openai/custom-voice-provider";

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
});
