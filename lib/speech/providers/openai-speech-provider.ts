import "server-only";

import {
  OpenAiSceneAudioProvider,
  type AudioGenerationProviderInput,
} from "@/lib/openai/scene-audio-provider";
import {
  SpeechProviderUnsupportedError,
  type SpeechProvider,
  type SpeechSynthesisRequest,
  type SpeechSynthesisResult,
} from "@/lib/speech/speech-provider";
import type { VoiceCloningCapability } from "@/lib/speech/voice-cloning-capability";

/**
 * OpenAI speech, behind the shared seam.
 *
 * Deliberately a thin wrapper over the existing provider rather than a rewrite
 * of it. That class already encodes hard-won detail — which models honour
 * `speed`, how an empty body is reported — and reproducing it here to satisfy
 * an interface would be a good way to lose it.
 *
 * Its cloning is *enrolled*: a voice is created once and referred to by an
 * identifier afterwards, so a reference clip has nothing to attach to and is
 * refused rather than ignored.
 */

/** OpenAI's documented input ceiling for a single speech request. */
export const OPENAI_SPEECH_MAXIMUM_CHARACTERS = 4_096;

export class OpenAiSpeechProvider implements SpeechProvider {
  readonly id = "openai" as const;
  readonly capability: VoiceCloningCapability = {
    kind: "enrolled",
    requiresConsentRecording: true,
  };
  readonly maximumCharacters = OPENAI_SPEECH_MAXIMUM_CHARACTERS;

  constructor(
    private readonly input: {
      provider: OpenAiSceneAudioProvider;
      model: string;
    },
  ) {}

  async synthesize(
    request: SpeechSynthesisRequest,
  ): Promise<SpeechSynthesisResult> {
    if (request.voice.kind === "zero_shot")
      throw new SpeechProviderUnsupportedError(
        "This provider clones voices by enrolling them, not from a reference recording sent with each request.",
      );

    const voice: AudioGenerationProviderInput["voice"] =
      request.voice.kind === "enrolled"
        ? { kind: "custom", id: request.voice.providerVoiceId }
        : { kind: "built_in", name: request.voice.name };

    const result = await this.input.provider.generate({
      model: this.input.model,
      text: request.text,
      voice,
      format: request.format,
      speedScaledPercent: request.speedScaledPercent,
      instructions: request.instructions,
      endUserId: request.endUserId,
    });

    return { ...result, provider: "openai" };
  }
}
