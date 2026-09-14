import "server-only";

import {
  getSceneAudioEnvironment,
  getSpeechProviderEnvironment,
} from "@/lib/env/server";
import { OpenAiSceneAudioProvider } from "@/lib/openai/scene-audio-provider";
import { MagpieSpeechProvider } from "@/lib/speech/providers/magpie-speech-provider";
import { MagpieHttpTransport } from "@/lib/speech/providers/magpie-transport";
import { OpenAiSpeechProvider } from "@/lib/speech/providers/openai-speech-provider";
import type { SpeechProvider } from "@/lib/speech/speech-provider";
import type { SpeechProviderId } from "@/lib/speech/voice-cloning-capability";

/**
 * Builds a speech provider by name.
 *
 * The one place that knows how each provider is wired, so that everywhere else
 * — the worker, the preview route, the enrolment screens — asks for a provider
 * by name and gets something it can use without learning anyone's SDK.
 *
 * Nothing is constructed until it is asked for. A deployment narrating with
 * OpenAI never builds the NVIDIA transport and so never needs its credentials,
 * which is what lets the two coexist in one configuration.
 */
export function createSpeechProvider(id: SpeechProviderId): SpeechProvider {
  if (id === "openai") {
    const audio = getSceneAudioEnvironment();
    return new OpenAiSpeechProvider({
      model: audio.OPENAI_TTS_MODEL,
      provider: new OpenAiSceneAudioProvider({
        apiKey: audio.OPENAI_API_KEY,
        timeoutMilliseconds: audio.OPENAI_REQUEST_TIMEOUT_SECONDS * 1_000,
      }),
    });
  }

  const speech = getSpeechProviderEnvironment();
  if (!speech.MAGPIE_BASE_URL)
    // Unreachable through configuration, which the schema refuses, but a
    // direct caller could still ask for a provider this deployment cannot
    // build. Better a named failure than a request to `undefined`.
    throw new Error("MAGPIE_BASE_URL is not configured.");

  return new MagpieSpeechProvider({
    model: speech.MAGPIE_TTS_MODEL,
    promptQuality: speech.MAGPIE_PROMPT_QUALITY,
    sampleRateHz: speech.MAGPIE_SAMPLE_RATE_HZ,
    transport: new MagpieHttpTransport({
      baseUrl: speech.MAGPIE_BASE_URL,
      timeoutMilliseconds: speech.MAGPIE_REQUEST_TIMEOUT_SECONDS * 1_000,
      headers: magpieHeaders(speech),
    }),
  });
}

/** The configured default, used for catalogue voices and new enrolments. */
export function getConfiguredSpeechProviderId(): SpeechProviderId {
  return getSpeechProviderEnvironment().SPEECH_PROVIDER;
}

/**
 * Only the headers the deployment actually has.
 *
 * A Speech NIM on your own network authenticates nothing, and sending an empty
 * bearer token to one is a good way to turn a working setup into a 401.
 */
function magpieHeaders(speech: {
  NVIDIA_API_KEY?: string;
  NVIDIA_FUNCTION_ID?: string;
}): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  if (speech.NVIDIA_API_KEY)
    headers.Authorization = `Bearer ${speech.NVIDIA_API_KEY}`;
  if (speech.NVIDIA_FUNCTION_ID)
    headers["function-id"] = speech.NVIDIA_FUNCTION_ID;
  return Object.keys(headers).length > 0 ? headers : undefined;
}
