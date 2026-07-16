import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import {
  classifyImageGenerationError,
  shouldRetryImageGeneration,
} from "@/lib/openai/image-generation-error";
import { ImageGenerationProviderResponseError } from "@/lib/openai/image-generation-provider";

describe("classifyImageGenerationError", () => {
  it("allows bounded retry for rate limits", () => {
    const error = OpenAI.APIError.generate(
      429,
      { error: { message: "busy" } },
      "busy",
      new Headers({ "x-request-id": "request-1" }),
    );
    expect(classifyImageGenerationError(error)).toMatchObject({
      category: "rate_limit",
      retriable: true,
      providerMayHaveAcceptedRequest: false,
    });
  });

  it("does not automatically retry ambiguous transport failures", () => {
    expect(
      classifyImageGenerationError(new OpenAI.APIConnectionTimeoutError()),
    ).toMatchObject({
      category: "transport_ambiguous",
      retriable: false,
      providerMayHaveAcceptedRequest: true,
    });
  });

  it("does not retry an invalid image returned after a billable request", () => {
    expect(
      classifyImageGenerationError(
        new ImageGenerationProviderResponseError({
          code: "OPENAI_IMAGE_DATA_INVALID",
          requestId: "request-2",
          usage: null,
        }),
      ),
    ).toEqual({
      category: "invalid_provider_response",
      safeMessage: "The image provider returned an unusable image.",
      retriable: false,
      providerMayHaveAcceptedRequest: true,
      requestId: "request-2",
    });
  });

  it("stops transient retries at the configured attempt limit", () => {
    expect(
      shouldRetryImageGeneration({
        failure: { retriable: true },
        attemptNumber: 1,
        maximumAttempts: 2,
      }),
    ).toBe(true);
    expect(
      shouldRetryImageGeneration({
        failure: { retriable: true },
        attemptNumber: 2,
        maximumAttempts: 2,
      }),
    ).toBe(false);
    expect(
      shouldRetryImageGeneration({
        failure: { retriable: false },
        attemptNumber: 1,
        maximumAttempts: 2,
      }),
    ).toBe(false);
  });
});
