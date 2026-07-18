import OpenAI from "openai";
import { AudioGenerationProviderResponseError } from "@/lib/openai/scene-audio-provider";

export interface AudioGenerationFailure {
  category: string;
  safeMessage: string;
  retriable: boolean;
  providerMayHaveBilled: boolean;
}

export function classifyAudioGenerationError(
  error: unknown,
): AudioGenerationFailure {
  if (error instanceof OpenAI.APIConnectionTimeoutError)
    return {
      category: "provider_timeout",
      safeMessage: "The narration request timed out. Please try again.",
      retriable: true,
      providerMayHaveBilled: false,
    };
  if (error instanceof OpenAI.RateLimitError)
    return {
      category: "provider_rate_limited",
      safeMessage: "The audio service is busy. Please try again shortly.",
      retriable: true,
      providerMayHaveBilled: false,
    };
  if (error instanceof AudioGenerationProviderResponseError)
    return {
      category: "provider_empty_response",
      safeMessage: "The audio provider returned an empty result.",
      retriable: false,
      providerMayHaveBilled: true,
    };
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    if (status >= 500)
      return {
        category: "provider_unavailable",
        safeMessage: "The audio service is temporarily unavailable.",
        retriable: true,
        providerMayHaveBilled: false,
      };
    return {
      category: "provider_rejected",
      safeMessage: "The narration request was rejected by the audio service.",
      retriable: false,
      providerMayHaveBilled: false,
    };
  }
  return {
    category: "provider_error",
    safeMessage: "The narration could not be generated.",
    retriable: false,
    providerMayHaveBilled: false,
  };
}

export function shouldRetryAudioGeneration(input: {
  failure: AudioGenerationFailure;
  attemptNumber: number;
  maximumAttempts: number;
}): boolean {
  return input.failure.retriable && input.attemptNumber < input.maximumAttempts;
}
