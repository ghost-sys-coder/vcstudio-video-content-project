import "server-only";
import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { z } from "zod";
import { requireElevenLabs } from "./configuration";
import {
  SpeechProviderRequestError,
  SpeechProviderUnsupportedError,
  type SpeechProvider,
  type SpeechSynthesisRequest,
  type SpeechSynthesisResult,
} from "@/lib/speech/speech-provider";
import { boundedResponseBytes } from "@/lib/video-generation/providers/provider-http";

export class ElevenLabsSpeechProvider implements SpeechProvider {
  constructor(private readonly expectedModel?: string) {}
  readonly id = "elevenlabs" as const;
  // Existing account voices can be selected. This adapter cannot enrol voices.
  readonly capability = { kind: "none" } as const;
  readonly maximumCharacters = 4000;
  async synthesize(
    request: SpeechSynthesisRequest,
  ): Promise<SpeechSynthesisResult> {
    const env = requireElevenLabs();
    if (this.expectedModel && this.expectedModel !== env.ELEVENLABS_TTS_MODEL)
      throw new SpeechProviderUnsupportedError(
        "The ElevenLabs model changed. Prepare a new request with the current model.",
      );
    if (
      request.voice.kind !== "built_in" ||
      !/^[A-Za-z0-9_-]{10,100}$/.test(request.voice.name)
    )
      throw new SpeechProviderUnsupportedError(
        "Select an existing ElevenLabs account voice.",
      );
    if (
      !request.text.trim() ||
      request.text.length > this.maximumCharacters ||
      request.speedScaledPercent < 70 ||
      request.speedScaledPercent > 120
    )
      throw new SpeechProviderUnsupportedError(
        "ElevenLabs accepts up to 4,000 characters at 70–120% speed.",
      );
    const formats = {
      mp3: "mp3_44100_128",
      wav: "pcm_24000",
      opus: "opus_48000_64",
    } as const;
    if (
      request.format !== "mp3" &&
      request.format !== "wav" &&
      request.format !== "opus"
    )
      throw new SpeechProviderUnsupportedError(
        "ElevenLabs narration supports MP3, WAV and Opus.",
      );
    const client = new ElevenLabsClient({
      apiKey: env.ELEVEN_LABS_API_KEY,
      maxRetries: 0,
      timeoutInSeconds: 120,
    });
    try {
      const { data, rawResponse } = await client.textToSpeech
        .convert(
          request.voice.name,
          {
            text: request.text,
            modelId: env.ELEVENLABS_TTS_MODEL,
            outputFormat: formats[request.format],
            voiceSettings: { speed: request.speedScaledPercent / 100 },
          },
          { maxRetries: 0 },
        )
        .withRawResponse();
      const raw = await boundedResponseBytes(
        new Response(data),
        32 * 1024 * 1024,
      );
      const bytes = request.format === "wav" ? pcmWav(raw) : raw;
      const characterCount = z.coerce
        .number()
        .int()
        .nonnegative()
        .safeParse(rawResponse.headers.get("x-character-count"));
      const charged =
        characterCount.success && characterCount.data > 0
          ? characterCount.data
          : request.text.length;
      return {
        provider: this.id,
        model: env.ELEVENLABS_TTS_MODEL,
        requestId: rawResponse.headers.get("request-id"),
        bytes,
        contentType:
          request.format === "mp3"
            ? "audio/mpeg"
            : request.format === "wav"
              ? "audio/wav"
              : "audio/ogg",
        format: request.format,
        characterCount: charged,
        safeMetadata: {
          inputCharacters: request.text.length,
          chargedCharacterCount:
            characterCount.success && characterCount.data > 0
              ? characterCount.data
              : null,
          costBasis: "conservative_credit_valuation",
          instructionsSupported: false,
        },
      };
    } catch (error) {
      const status =
        error instanceof ElevenLabsError ? (error.statusCode ?? null) : null;
      throw new SpeechProviderRequestError({
        code: `elevenlabs_${status ?? "uncertain"}`,
        status,
        message:
          status === 401 || status === 403
            ? "Check the ElevenLabs key and voice permissions."
            : status === 402 || status === 429
              ? "ElevenLabs credits or request capacity are unavailable."
              : "ElevenLabs speech failed. Inspect this operation before retrying.",
        retriable: false,
      });
    }
  }
}
function pcmWav(bytes: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(bytes.length + 36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(bytes.length, 40);
  return Buffer.concat([header, bytes]);
}
