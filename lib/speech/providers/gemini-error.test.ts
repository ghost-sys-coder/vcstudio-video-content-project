import { describe, expect, it } from "vitest";
import {
  diagnoseGeminiFailure,
  diagnoseGeminiTransportFailure,
  geminiRequestError,
} from "@/lib/speech/providers/gemini-error";

function googleError(
  code: number,
  status: string,
  message: string,
  details: unknown[] = [],
) {
  return JSON.stringify({ error: { code, status, message, details } });
}

/**
 * Captured from Google on 2026-09-27: a consent clip that did not recite the
 * required sentence, reported as a 500 translation error with the real 400
 * and explanation buried in a debug detail.
 */
const WRAPPED_CONSENT_MISMATCH = JSON.stringify({
  error: {
    code: 500,
    message: "Error translating server response to JSON",
    status: "INTERNAL",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.DebugInfo",
        detail:
          'INTERNAL: Invalid type URL, unknown type: google.rpc.context.HttpHeaderContext\nOriginal error: INVALID_ARGUMENT: Consent flow failed. Please follow instructions at https://ai.google.dev/gemini-api/docs/speech-generation for troubleshooting.\nThe recorded phrase didn\'t match the text on screen. Please read the prompt exactly as written. [type.googleapis.com/util.MessageSetPayload=\'[google.rpc.error_details_ext] { details { [type.googleapis.com/google.api.HttpBody] { content_type: "application/json" data: "{}" extensions { [type.googleapis.com/google.rpc.context.HttpHeaderContext] { headers { key: ":status" value: "400" } } } } } }\']',
      },
    ],
  },
});

describe("diagnoseGeminiFailure", () => {
  it("sees through a 500 that is really a consent mismatch", () => {
    const failure = diagnoseGeminiFailure({
      httpStatus: 500,
      body: WRAPPED_CONSENT_MISMATCH,
    });
    expect(failure.reason).toBe("consent_mismatch");
    expect(failure.status).toBe(400);
    expect(failure.retriable).toBe(false);
    expect(failure.message).toMatch(/consent recording/);
    expect(failure.message).not.toMatch(/unavailable|try again shortly/i);
  });

  it("names an invalid or expired API key", () => {
    const failure = diagnoseGeminiFailure({
      httpStatus: 400,
      body: googleError(
        400,
        "INVALID_ARGUMENT",
        "API key not valid. Please pass a valid API key.",
        [
          {
            "@type": "type.googleapis.com/google.rpc.ErrorInfo",
            reason: "API_KEY_INVALID",
          },
        ],
      ),
    });
    expect(failure.reason).toBe("api_key_invalid");
    expect(failure.message).toMatch(/GOOGLE_GEMINI_API_KEY/);
  });

  it("names depleted prepaid credits", () => {
    const failure = diagnoseGeminiFailure({
      httpStatus: 429,
      body: googleError(
        429,
        "RESOURCE_EXHAUSTED",
        "Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.",
      ),
    });
    expect(failure.reason).toBe("credits_depleted");
    expect(failure.message).toMatch(/credits are used up/);
    expect(failure.retriable).toBe(false);
  });

  it("reads a zero free-tier limit as needing billing, not waiting", () => {
    const failure = diagnoseGeminiFailure({
      httpStatus: 429,
      model: "gemini-3.8-flash-tts",
      body: googleError(
        429,
        "RESOURCE_EXHAUSTED",
        "You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-3.8-flash-tts",
      ),
    });
    expect(failure.reason).toBe("billing_required");
    expect(failure.message).toMatch(/free tier/);
    expect(failure.message).toMatch(/gemini-3\.8-flash-tts/);
  });

  it("separates a used-up quota from a momentary rate limit", () => {
    expect(
      diagnoseGeminiFailure({
        httpStatus: 429,
        body: googleError(
          429,
          "RESOURCE_EXHAUSTED",
          "You exceeded your current quota, please check your plan and billing details. limit: 100",
        ),
      }).reason,
    ).toBe("quota_exhausted");
    const rate = diagnoseGeminiFailure({
      httpStatus: 429,
      body: googleError(429, "RESOURCE_EXHAUSTED", "Too many requests."),
    });
    expect(rate.reason).toBe("rate_limited");
    expect(rate.retriable).toBe(true);
  });

  it("names a disabled API and an unsupported region", () => {
    expect(
      diagnoseGeminiFailure({
        httpStatus: 403,
        body: googleError(
          403,
          "PERMISSION_DENIED",
          "Generative Language API has not been used in project 123 before or it is disabled.",
          [{ reason: "SERVICE_DISABLED" }],
        ),
      }).reason,
    ).toBe("api_not_enabled");
    expect(
      diagnoseGeminiFailure({
        httpStatus: 400,
        body: googleError(
          400,
          "FAILED_PRECONDITION",
          "User location is not supported for the API use.",
        ),
      }).reason,
    ).toBe("location_unsupported");
  });

  it("names billing that is off, and a model the key cannot use", () => {
    expect(
      diagnoseGeminiFailure({
        httpStatus: 400,
        body: googleError(
          400,
          "FAILED_PRECONDITION",
          "This API method requires billing to be enabled.",
        ),
      }).reason,
    ).toBe("billing_required");
    expect(
      diagnoseGeminiFailure({
        httpStatus: 404,
        model: "gemini-9-tts",
        body: googleError(
          404,
          "NOT_FOUND",
          "models/gemini-9-tts is not found for API version v1beta.",
        ),
      }).message,
    ).toMatch(/gemini-9-tts.*GEMINI_TTS_MODEL/);
  });

  it("treats a plain 403 as a permission problem and a genuine 503 as an outage", () => {
    expect(
      diagnoseGeminiFailure({
        httpStatus: 403,
        body: googleError(
          403,
          "PERMISSION_DENIED",
          "The caller does not have permission",
        ),
      }).reason,
    ).toBe("permission_denied");
    const outage = diagnoseGeminiFailure({
      httpStatus: 503,
      body: googleError(
        503,
        "UNAVAILABLE",
        "The service is currently unavailable.",
      ),
    });
    expect(outage.reason).toBe("provider_outage");
    expect(outage.retriable).toBe(true);
    expect(outage.googleMessage).toBe("The service is currently unavailable.");
  });

  it("keeps Google's words but never encoded audio", () => {
    const audio = "A".repeat(500);
    const failure = diagnoseGeminiFailure({
      httpStatus: 400,
      body: googleError(
        400,
        "INVALID_ARGUMENT",
        `Invalid audio sample ${audio} too short`,
      ),
    });
    expect(failure.reason).toBe("recording_rejected");
    expect(failure.googleMessage).not.toContain(audio);
    expect(failure.googleMessage).toContain("too short");
  });

  it("copes with a body that is not JSON", () => {
    const failure = diagnoseGeminiFailure({
      httpStatus: 502,
      body: "<html>Bad Gateway</html>",
    });
    expect(failure.reason).toBe("provider_outage");
    expect(failure.message).toMatch(/HTTP 502/);
  });
});

describe("diagnoseGeminiTransportFailure", () => {
  it("tells a timeout from a failed connection", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(diagnoseGeminiTransportFailure(abort, 30).message).toMatch(
      /within 30 seconds/,
    );
    expect(
      diagnoseGeminiTransportFailure(new TypeError("fetch failed")).reason,
    ).toBe("unreachable");
  });
});

describe("geminiRequestError", () => {
  it("carries the diagnosis on the thrown error", () => {
    const error = geminiRequestError(
      diagnoseGeminiFailure({
        httpStatus: 500,
        body: WRAPPED_CONSENT_MISMATCH,
      }),
      "req-1",
    );
    expect(error.code).toBe("GEMINI_CONSENT_MISMATCH");
    expect(error.reason).toBe("consent_mismatch");
    expect(error.status).toBe(400);
    expect(error.requestId).toBe("req-1");
    expect(error.retriable).toBe(false);
  });
});
