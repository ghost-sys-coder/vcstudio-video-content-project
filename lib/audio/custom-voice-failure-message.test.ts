import { describe, expect, it } from "vitest";
import {
  customVoiceFailureMessage,
  customVoiceFailureStatus,
} from "@/lib/audio/custom-voice-failure-message";
import { CustomVoiceProviderError } from "@/lib/domain/errors";

describe("customVoiceFailureMessage", () => {
  it("does not blame the recording when the provider has no voice endpoints", () => {
    const message = customVoiceFailureMessage(
      new CustomVoiceProviderError("provider_unavailable", 404, null, null),
    );
    expect(message).toContain("not available on the connected provider");
    expect(message.toLowerCase()).not.toContain("consent phrase");
    expect(message.toLowerCase()).not.toContain("recording quality");
  });

  it("does not blame the recording for a credential failure", () => {
    const message = customVoiceFailureMessage(
      new CustomVoiceProviderError("unauthorized", 401, null, null),
    );
    expect(message).toContain("Your recording was not the problem");
  });

  it("relays the provider's own reason when the recording is rejected", () => {
    expect(
      customVoiceFailureMessage(
        new CustomVoiceProviderError(
          "recording_rejected",
          400,
          "consent phrase did not match",
          "req_1",
        ),
      ),
    ).toContain("consent phrase did not match");
  });

  it("asks for a retry when the recording is rejected without a reason", () => {
    expect(
      customVoiceFailureMessage(
        new CustomVoiceProviderError("recording_rejected", 422, null, null),
      ),
    ).toContain("quiet room");
  });

  it("falls back safely for a non-provider error", () => {
    expect(customVoiceFailureMessage(new Error("boom"))).toContain(
      "before it reached the voice provider",
    );
  });
});

describe("customVoiceFailureStatus", () => {
  it("separates provider outages from rejected input", () => {
    expect(
      customVoiceFailureStatus(
        new CustomVoiceProviderError("provider_unavailable", 404, null, null),
      ),
    ).toBe(503);
    expect(
      customVoiceFailureStatus(
        new CustomVoiceProviderError("recording_rejected", 400, null, null),
      ),
    ).toBe(422);
    expect(
      customVoiceFailureStatus(
        new CustomVoiceProviderError("rate_limited", 429, null, null),
      ),
    ).toBe(429);
    expect(customVoiceFailureStatus(new Error("boom"))).toBe(500);
  });
});
