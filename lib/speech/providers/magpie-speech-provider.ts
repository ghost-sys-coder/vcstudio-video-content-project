import "server-only";

import {
  SpeechProviderUnsupportedError,
  type SpeechProvider,
  type SpeechSynthesisRequest,
  type SpeechSynthesisResult,
} from "@/lib/speech/speech-provider";
import {
  MAGPIE_REFERENCE_REQUIREMENTS,
  type VoiceCloningCapability,
} from "@/lib/speech/voice-cloning-capability";
import type { MagpieTransport } from "@/lib/speech/providers/magpie-transport";

/**
 * NVIDIA Magpie TTS Zeroshot, behind the shared speech seam.
 *
 * **Zero-shot means the provider remembers nothing.** There is no enrolment
 * call and no voice identifier: the reference clip travels with every single
 * request, and the cloned voice exists precisely as long as our copy of that
 * clip does. Everything unusual about this adapter follows from that.
 *
 * Two limits are declared rather than discovered. The endpoint accepts at most
 * two thousand characters — half what the OpenAI path allows — and it answers
 * with LINEAR_PCM in a WAV container and nothing else. Both would otherwise
 * surface as a provider rejection after the caller had already committed to a
 * generation, so a request that cannot be served is refused here instead.
 */

/** NVIDIA documents a 2,000 character ceiling after text normalization. */
export const MAGPIE_MAXIMUM_CHARACTERS = 2_000;

/** The endpoint returns LINEAR_PCM in a WAV container; there is no alternative. */
const MAGPIE_OUTPUT_FORMAT = "wav";

export class MagpieSpeechProvider implements SpeechProvider {
  readonly id = "magpie" as const;
  readonly capability: VoiceCloningCapability = {
    kind: "zero_shot",
    reference: MAGPIE_REFERENCE_REQUIREMENTS,
  };
  readonly maximumCharacters = MAGPIE_MAXIMUM_CHARACTERS;

  constructor(
    private readonly input: {
      transport: MagpieTransport;
      model: string;
      /** 1–40; NVIDIA's default is 20. Higher adapts harder to the reference. */
      promptQuality: number;
      sampleRateHz: number;
    },
  ) {}

  async synthesize(
    request: SpeechSynthesisRequest,
  ): Promise<SpeechSynthesisResult> {
    const text = request.text.trim();
    if (text.length === 0)
      throw new RangeError("Audio narration text is required.");

    if (text.length > MAGPIE_MAXIMUM_CHARACTERS)
      throw new SpeechProviderUnsupportedError(
        `This voice accepts ${MAGPIE_MAXIMUM_CHARACTERS} characters at a time and the narration is ${text.length}. Split the scene or choose a different voice.`,
      );

    // Refused rather than silently answered in WAV: a caller that asked for mp3
    // will store the bytes under an mp3 key and hand a mislabelled file to the
    // renderer, which is a worse failure than this one.
    if (request.format !== MAGPIE_OUTPUT_FORMAT)
      throw new SpeechProviderUnsupportedError(
        `This voice can only produce WAV audio, and ${request.format} was requested.`,
      );

    if (request.voice.kind === "enrolled")
      throw new SpeechProviderUnsupportedError(
        "This provider does not enrol voices. Its cloned voices are reproduced from a stored reference recording instead.",
      );

    // Speed is not a parameter this endpoint exposes. Saying so is better than
    // accepting the number and quietly ignoring it, which would leave a creator
    // adjusting a control that does nothing.
    if (request.speedScaledPercent !== 100)
      throw new SpeechProviderUnsupportedError(
        "This voice does not support speed adjustment. Leave the pace at its natural setting.",
      );

    const reference =
      request.voice.kind === "zero_shot" ? request.voice.reference : null;

    if (reference && this.capability.kind === "zero_shot") {
      const needsTranscript =
        this.capability.reference.requiresTranscript &&
        !reference.transcript?.trim();
      if (needsTranscript)
        throw new SpeechProviderUnsupportedError(
          "This model needs the words spoken in the reference recording.",
        );
    }

    const { bytes, requestId } = await this.input.transport.synthesize({
      text,
      language: request.language,
      voice: request.voice.kind === "built_in" ? request.voice.name : undefined,
      sampleRateHz: this.input.sampleRateHz,
      promptQuality: this.input.promptQuality,
      audioPrompt: reference
        ? { bytes: reference.bytes, transcript: reference.transcript }
        : undefined,
    });

    return {
      provider: "magpie",
      model: this.input.model,
      requestId,
      bytes,
      contentType: "audio/wav",
      format: MAGPIE_OUTPUT_FORMAT,
      characterCount: text.length,
      safeMetadata: {
        // Never the clip, and never a voice identifier that does not exist:
        // just the shape of what was asked for.
        voice:
          request.voice.kind === "built_in" ? request.voice.name : "cloned",
        cloned: reference !== null,
        language: request.language,
        sampleRateHz: this.input.sampleRateHz,
        promptQuality: this.input.promptQuality,
        characterCount: text.length,
      },
    };
  }
}
