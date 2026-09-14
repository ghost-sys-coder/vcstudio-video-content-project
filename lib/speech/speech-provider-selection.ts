/**
 * Which speech provider serves a given request, decided as data.
 *
 * **A workspace does not get one provider, it gets one per voice.** That is not
 * a flourish: a cloned voice belongs to the provider that can reproduce it, and
 * nothing else can. A zero-shot clone is a reference clip that only Magpie
 * knows what to do with; an enrolled voice is an identifier that lives in
 * OpenAI's account and means nothing to NVIDIA. Choosing a provider globally
 * and hoping every voice follows would silently narrate a scene in the wrong
 * voice, which is far worse than refusing.
 *
 * So the configured provider decides what *new* voices are made with and which
 * catalogue voices are offered, while an existing cloned voice keeps naming its
 * own. Switching providers is then safe at any moment: work already done stays
 * reproducible, and only the next new voice changes hands.
 */

import type { SpeechProviderId } from "@/lib/speech/voice-cloning-capability";

export const SPEECH_PROVIDER_IDS: readonly SpeechProviderId[] = [
  "openai",
  "magpie",
] as const;

export function isSpeechProviderId(value: string): value is SpeechProviderId {
  return (SPEECH_PROVIDER_IDS as readonly string[]).includes(value);
}

/** What the caller knows about the voice it wants spoken. */
export type VoiceRequest =
  | { kind: "built_in"; name: string }
  | {
      kind: "custom";
      /** The provider recorded against the voice when it was created. */
      provider: string;
    };

export type SpeechProviderDecision =
  | {
      ok: true;
      provider: SpeechProviderId;
      reason: "configured" | "voice_owner";
    }
  | { ok: false; reason: "unknown_voice_provider"; message: string };

export function selectSpeechProvider(input: {
  configured: SpeechProviderId;
  voice: VoiceRequest;
}): SpeechProviderDecision {
  if (input.voice.kind === "built_in")
    return { ok: true, provider: input.configured, reason: "configured" };

  if (!isSpeechProviderId(input.voice.provider))
    return {
      ok: false,
      reason: "unknown_voice_provider",
      // Named rather than swallowed: a voice whose provider is no longer built
      // in cannot be spoken, and the operator needs to know which one is
      // missing to decide whether to restore it or re-record the voice.
      message: `This voice was created with "${input.voice.provider}", which this deployment can no longer reach.`,
    };

  // The voice wins over the configured provider, always. It is the only one
  // that can reproduce it.
  return { ok: true, provider: input.voice.provider, reason: "voice_owner" };
}
