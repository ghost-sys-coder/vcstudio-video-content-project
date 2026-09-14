import { describe, expect, it } from "vitest";
import {
  isSpeechProviderId,
  selectSpeechProvider,
  SPEECH_PROVIDER_IDS,
} from "@/lib/speech/speech-provider-selection";

describe("isSpeechProviderId", () => {
  it("accepts every provider the deployment ships", () => {
    for (const id of SPEECH_PROVIDER_IDS)
      expect(isSpeechProviderId(id)).toBe(true);
  });

  it("rejects anything else, including near misses", () => {
    expect(isSpeechProviderId("nvidia")).toBe(false);
    expect(isSpeechProviderId("OpenAI")).toBe(false);
    expect(isSpeechProviderId("")).toBe(false);
  });
});

describe("selectSpeechProvider", () => {
  it("uses the configured provider for a catalogue voice", () => {
    const decision = selectSpeechProvider({
      configured: "magpie",
      voice: { kind: "built_in", name: "Magpie-ZeroShot-Multilingual.Female" },
    });
    expect(decision).toEqual({
      ok: true,
      provider: "magpie",
      reason: "configured",
    });
  });

  // The point of the whole module: a cloned voice can only be reproduced by the
  // provider that made it, so switching the configured provider must not
  // silently narrate an existing scene in somebody else's voice.
  it("keeps a cloned voice with its own provider when the default changes", () => {
    const decision = selectSpeechProvider({
      configured: "magpie",
      voice: { kind: "custom", provider: "openai" },
    });
    expect(decision).toEqual({
      ok: true,
      provider: "openai",
      reason: "voice_owner",
    });
  });

  it("holds in the other direction too", () => {
    const decision = selectSpeechProvider({
      configured: "openai",
      voice: { kind: "custom", provider: "magpie" },
    });
    expect(decision).toEqual({
      ok: true,
      provider: "magpie",
      reason: "voice_owner",
    });
  });

  it("agrees with the configuration when they already match", () => {
    const decision = selectSpeechProvider({
      configured: "openai",
      voice: { kind: "custom", provider: "openai" },
    });
    expect(decision.ok && decision.provider).toBe("openai");
  });

  // A voice recorded against a provider the deployment no longer builds in is
  // unreproducible. Refusing names it; falling back would narrate in a
  // different voice and look like success.
  it("refuses a voice whose provider is no longer available", () => {
    const decision = selectSpeechProvider({
      configured: "openai",
      voice: { kind: "custom", provider: "elevenlabs" },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.reason).toBe("unknown_voice_provider");
      expect(decision.message).toContain("elevenlabs");
    }
  });

  it("never silently falls back to the configured provider", () => {
    const decision = selectSpeechProvider({
      configured: "magpie",
      voice: { kind: "custom", provider: "retired-vendor" },
    });
    expect(decision.ok).toBe(false);
  });
});
