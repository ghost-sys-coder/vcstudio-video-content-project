import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { classifyAudioGenerationError } from "@/lib/openai/audio-generation-error";
import {
  SpeechProviderRequestError,
  SpeechProviderUnsupportedError,
} from "@/lib/speech/speech-provider";

function requestError(code: string, status: number | null) {
  return new SpeechProviderRequestError({ code, message: "failed", status });
}

describe("classifyAudioGenerationError for the speech seam", () => {
  it("retries transient failures without assuming a charge", () => {
    for (const error of [
      requestError("GEMINI_TIMEOUT", null),
      requestError("GEMINI_HTTP_429", 429),
      requestError("GEMINI_HTTP_503", 503),
    ]) {
      const failure = classifyAudioGenerationError(error);
      expect(failure.retriable).toBe(true);
      expect(failure.providerMayHaveBilled).toBe(false);
    }
  });

  it("does not retry a rejected request", () => {
    const failure = classifyAudioGenerationError(
      requestError("GEMINI_HTTP_400", 400),
    );
    expect(failure.category).toBe("provider_rejected");
    expect(failure.retriable).toBe(false);
  });

  it("treats empty audio as permanent and possibly billed", () => {
    const failure = classifyAudioGenerationError(
      requestError("GEMINI_EMPTY_AUDIO", null),
    );
    expect(failure.category).toBe("provider_empty_response");
    expect(failure.retriable).toBe(false);
    expect(failure.providerMayHaveBilled).toBe(true);
  });

  it("passes an unsupported request's own message through, unretried", () => {
    const failure = classifyAudioGenerationError(
      new SpeechProviderUnsupportedError("This voice does not support speed."),
    );
    expect(failure.safeMessage).toBe("This voice does not support speed.");
    expect(failure.retriable).toBe(false);
  });
});
