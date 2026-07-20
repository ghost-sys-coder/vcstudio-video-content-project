import "server-only";

import { createHash } from "node:crypto";
import { getSceneAudioEnvironment } from "@/lib/env/server";
import { OpenAiSceneAudioProvider } from "@/lib/openai/scene-audio-provider";
import {
  VOICE_PREVIEW_SAMPLE_TEXT,
  isPreviewVoice,
} from "@/lib/audio/voice-catalog";
import { createVoicePreviewObjectKey } from "@/lib/storage/object-key";
import {
  findCachedVoicePreview,
  putVoicePreview,
} from "@/lib/storage/voice-preview-storage";

export interface VoicePreviewAudio {
  bytes: Buffer;
  contentType: string;
}

export class UnknownPreviewVoiceError extends Error {
  constructor(voice: string) {
    super(`Unknown preview voice: ${voice}`);
    this.name = "UnknownPreviewVoiceError";
  }
}

const PREVIEW_FORMAT = "mp3" as const;

function sampleHash(): string {
  return createHash("sha256")
    .update(VOICE_PREVIEW_SAMPLE_TEXT)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Returns the audio clip of a single voice reading the fixed sample line,
 * synthesizing it once and caching it in R2 for every subsequent request.
 *
 * Cost is bounded by construction: the sample text is fixed and the voice must
 * come from the catalogue allow-list, so across the whole system only one short
 * clip per voice is ever synthesized. That structural bound is why this does
 * not go through the per-workspace usage-reservation ledger — a preview is a
 * shared, one-time system asset, not workspace-billed usage.
 */
export async function getVoicePreviewAudio(input: {
  voice: string;
}): Promise<VoicePreviewAudio> {
  if (!isPreviewVoice(input.voice))
    throw new UnknownPreviewVoiceError(input.voice);

  const environment = getSceneAudioEnvironment();
  const objectKey = createVoicePreviewObjectKey({
    model: environment.OPENAI_TTS_MODEL,
    voice: input.voice,
    sampleHash: sampleHash(),
  });

  const cached = await findCachedVoicePreview(objectKey);
  if (cached) return { bytes: cached.bytes, contentType: cached.contentType };

  const provider = new OpenAiSceneAudioProvider({
    apiKey: environment.OPENAI_API_KEY,
    timeoutMilliseconds: environment.OPENAI_REQUEST_TIMEOUT_SECONDS * 1_000,
  });
  const result = await provider.generate({
    model: environment.OPENAI_TTS_MODEL,
    text: VOICE_PREVIEW_SAMPLE_TEXT,
    voice: input.voice,
    format: PREVIEW_FORMAT,
    speedScaledPercent: 100,
  });

  await putVoicePreview({
    objectKey,
    bytes: result.bytes,
    contentType: result.contentType,
  });

  return { bytes: result.bytes, contentType: result.contentType };
}
