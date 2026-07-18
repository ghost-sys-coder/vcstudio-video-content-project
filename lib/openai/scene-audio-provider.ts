import "server-only";

import OpenAI from "openai";
import type { SceneAudioFormat } from "@/lib/schemas/scene-audio";

export class AudioGenerationProviderResponseError extends Error {
  readonly code: string;
  readonly requestId: string | null;

  constructor(input: { code: string; requestId: string | null }) {
    super(input.code);
    this.name = "AudioGenerationProviderResponseError";
    this.code = input.code;
    this.requestId = input.requestId;
  }
}

export interface AudioGenerationProviderInput {
  model: string;
  text: string;
  voice: string;
  format: SceneAudioFormat;
  speedScaledPercent: number;
  instructions?: string;
  endUserId?: string;
}

export interface AudioGenerationProviderResult {
  provider: "openai";
  model: string;
  requestId: string | null;
  bytes: Buffer;
  contentType: string;
  format: SceneAudioFormat;
  characterCount: number;
  safeMetadata: Record<string, string | number | boolean | null>;
}

export const AUDIO_CONTENT_TYPE_BY_FORMAT: Record<SceneAudioFormat, string> = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/pcm",
};

export const AUDIO_EXTENSION_BY_FORMAT: Record<SceneAudioFormat, string> = {
  mp3: "mp3",
  opus: "opus",
  aac: "aac",
  flac: "flac",
  wav: "wav",
  pcm: "pcm",
};

export class OpenAiSceneAudioProvider {
  private readonly client: OpenAI;

  constructor(input: {
    apiKey: string;
    timeoutMilliseconds?: number;
    client?: OpenAI;
  }) {
    if (input.apiKey.trim().length === 0)
      throw new RangeError("An OpenAI API key is required.");
    if (
      input.timeoutMilliseconds !== undefined &&
      (!Number.isFinite(input.timeoutMilliseconds) ||
        input.timeoutMilliseconds <= 0)
    )
      throw new RangeError("OpenAI timeout must be a positive number.");

    this.client =
      input.client ??
      new OpenAI({
        apiKey: input.apiKey,
        timeout: input.timeoutMilliseconds ?? 180_000,
        maxRetries: 0,
      });
  }

  async generate(
    input: AudioGenerationProviderInput,
  ): Promise<AudioGenerationProviderResult> {
    const trimmed = input.text.trim();
    if (trimmed.length === 0)
      throw new RangeError("Audio narration text is required.");
    const speed = input.speedScaledPercent / 100;

    const { data, request_id } = await this.client.audio.speech
      .create({
        model: input.model,
        input: trimmed,
        voice: input.voice,
        response_format: input.format,
        // OpenAI only honors `speed` on the classic tts models; only send it
        // when it deviates from the default so newer models do not reject it.
        ...(input.speedScaledPercent === 100 ? {} : { speed }),
        ...(input.instructions && input.instructions.trim().length > 0
          ? { instructions: input.instructions }
          : {}),
      })
      .withResponse();

    const arrayBuffer = await data.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (bytes.byteLength === 0)
      throw new AudioGenerationProviderResponseError({
        code: "OPENAI_AUDIO_DATA_MISSING",
        requestId: request_id,
      });

    return {
      provider: "openai",
      model: input.model,
      requestId: request_id,
      bytes,
      contentType: AUDIO_CONTENT_TYPE_BY_FORMAT[input.format],
      format: input.format,
      characterCount: trimmed.length,
      safeMetadata: {
        voice: input.voice,
        format: input.format,
        speedScaledPercent: input.speedScaledPercent,
        characterCount: trimmed.length,
      },
    };
  }
}
