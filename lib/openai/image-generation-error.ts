import OpenAI from "openai";
import { ImageGenerationProviderResponseError } from "@/lib/openai/image-generation-provider";

export type ImageGenerationFailure = {
  category:
    | "rate_limit"
    | "provider_server_error"
    | "transport_ambiguous"
    | "moderation_blocked"
    | "invalid_provider_request"
    | "invalid_provider_response"
    | "provider_error";
  safeMessage: string;
  retriable: boolean;
  providerMayHaveAcceptedRequest: boolean;
  requestId: string | null;
};

export function classifyImageGenerationError(
  error: unknown,
): ImageGenerationFailure {
  if (error instanceof ImageGenerationProviderResponseError)
    return {
      category: "invalid_provider_response",
      safeMessage: "The image provider returned an unusable image.",
      retriable: false,
      providerMayHaveAcceptedRequest: true,
      requestId: error.requestId,
    };

  if (
    error instanceof OpenAI.APIConnectionTimeoutError ||
    error instanceof OpenAI.APIConnectionError
  )
    return {
      category: "transport_ambiguous",
      safeMessage:
        "The image provider connection ended before completion could be confirmed.",
      retriable: false,
      providerMayHaveAcceptedRequest: true,
      requestId: error.requestID ?? null,
    };

  if (error instanceof OpenAI.RateLimitError)
    return {
      category: "rate_limit",
      safeMessage: "The image service is busy. Please try again shortly.",
      retriable: true,
      providerMayHaveAcceptedRequest: false,
      requestId: error.requestID ?? null,
    };

  if (error instanceof OpenAI.APIError) {
    if (error.code === "moderation_blocked")
      return {
        category: "moderation_blocked",
        safeMessage:
          "The image request was blocked by the provider's safety checks. Review the prompt and references.",
        retriable: false,
        providerMayHaveAcceptedRequest: false,
        requestId: error.requestID ?? null,
      };
    if (error.status !== undefined && error.status >= 500)
      return {
        category: "provider_server_error",
        safeMessage:
          "The image provider had a temporary server error. Please try again shortly.",
        retriable: true,
        providerMayHaveAcceptedRequest: false,
        requestId: error.requestID ?? null,
      };
    if (
      error.status === 400 ||
      error.status === 401 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 422 ||
      error.type === "image_generation_user_error"
    )
      return {
        category: "invalid_provider_request",
        safeMessage:
          "The image provider rejected the prompt, references, or configuration.",
        retriable: false,
        providerMayHaveAcceptedRequest: false,
        requestId: error.requestID ?? null,
      };
  }

  return {
    category: "provider_error",
    safeMessage: "The scene image could not be generated.",
    retriable: false,
    providerMayHaveAcceptedRequest: false,
    requestId: null,
  };
}

export function shouldRetryImageGeneration(input: {
  failure: Pick<ImageGenerationFailure, "retriable">;
  attemptNumber: number;
  maximumAttempts: number;
}): boolean {
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1)
    throw new RangeError("Attempt number must be a positive integer.");
  if (!Number.isInteger(input.maximumAttempts) || input.maximumAttempts < 1)
    throw new RangeError("Maximum attempts must be a positive integer.");
  return input.failure.retriable && input.attemptNumber < input.maximumAttempts;
}
