import { SpeechProviderRequestError } from "@/lib/speech/speech-provider";

/**
 * Turns a failed Google Gemini response into a reason a person can act on.
 *
 * Google's status code alone is not enough, and is sometimes wrong. A consent
 * recording that did not match the required sentence came back as
 * `500 INTERNAL "Error translating server response to JSON"`, with the real
 * `400` and the real explanation buried inside a debug detail. Read by status
 * alone, that is "Google is down" — which is what the user was told, while the
 * actual fix was to re-read the sentence. So the body is read, the wrapped
 * status and message are dug out, and the cause is named.
 *
 * Google's own wording is kept alongside, trimmed and scrubbed of anything
 * that looks like encoded audio, because it is often the most precise
 * description available and costs nothing to show.
 */

export type GeminiFailureReason =
  | "consent_mismatch"
  | "consent_rejected"
  | "recording_rejected"
  | "api_key_invalid"
  | "api_not_enabled"
  | "permission_denied"
  | "credits_depleted"
  | "billing_required"
  | "quota_exhausted"
  | "rate_limited"
  | "voice_limit"
  | "location_unsupported"
  | "model_unavailable"
  | "not_found"
  | "request_rejected"
  | "timeout"
  | "unreachable"
  | "provider_outage"
  | "unknown";

export interface GeminiFailure {
  reason: GeminiFailureReason;
  /** The status Google meant, which may differ from the one it sent. */
  status: number | null;
  /** Our explanation, written for the person who has to fix it. */
  message: string;
  /** Google's own words, scrubbed and trimmed, when it said anything useful. */
  googleMessage: string | null;
  retriable: boolean;
}

const RETRIABLE: ReadonlySet<GeminiFailureReason> = new Set([
  "rate_limited",
  "provider_outage",
  "timeout",
  "unreachable",
]);

/** Reasons whose explanation already says everything Google said. */
const SELF_EXPLANATORY: ReadonlySet<GeminiFailureReason> = new Set([
  "consent_mismatch",
  "timeout",
  "unreachable",
]);

interface GoogleErrorBody {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  details?: unknown;
}

function parseErrorBody(body: string): GoogleErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return null;
    const error: unknown = Reflect.get(parsed, "error");
    return typeof error === "object" && error !== null
      ? (error as GoogleErrorBody)
      : null;
  } catch {
    return null;
  }
}

/** Encoded audio or long tokens have no place in a message a person reads. */
function scrub(text: string): string {
  return text
    .replace(/[A-Za-z0-9+/=_-]{60,}/g, "…")
    .replace(/\\n|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

/**
 * Google sometimes reports a failure as a 500 translation error whose debug
 * detail carries the real one: `Original error: INVALID_ARGUMENT: …` and a
 * `:status` header of `400`. Both are recovered here.
 */
function unwrap(haystack: string): {
  status: number | null;
  message: string | null;
} {
  const wrappedStatus = /":status\\*"\s*value:\s*\\*"(\d{3})/.exec(haystack);
  const original =
    /Original error:\s*[A-Z_]+:\s*([\s\S]+?)(?:\s*\[type\.googleapis|$)/.exec(
      haystack,
    );
  return {
    status: wrappedStatus ? Number(wrappedStatus[1]) : null,
    message: original?.[1] ? original[1] : null,
  };
}

function messageFor(
  reason: GeminiFailureReason,
  input: { status: number | null; model?: string; timeoutSeconds?: number },
): string {
  switch (reason) {
    case "consent_mismatch":
      return "Google could not match your consent recording to the required sentence. Re-record it reading the sentence word for word, in one take, in the same voice and room as your sample.";
    case "consent_rejected":
      return "Google refused the consent recording. It must be you, reading the required sentence exactly, in the same voice as the sample.";
    case "recording_rejected":
      return "Google rejected the voice recordings. The consent clip must recite the required sentence exactly, in the same voice and setting as the sample, and the sample must be clear speech of the required length.";
    case "api_key_invalid":
      return "Google rejected GOOGLE_GEMINI_API_KEY: the key is invalid or has expired. Create a new key in Google AI Studio and update the environment.";
    case "api_not_enabled":
      return "The Generative Language API is not enabled on the Google Cloud project that owns this API key. Enable it in the Google Cloud console, wait a few minutes, then try again.";
    case "permission_denied":
      return "This Gemini API key is not allowed to do this. Check the key's API restrictions in Google Cloud, and that its project has access to voice replication.";
    case "credits_depleted":
      return "The Google project's prepaid credits are used up. Top up billing for the project in Google AI Studio, then try again.";
    case "billing_required":
      return `${input.model ? `"${input.model}"` : "This Gemini model"} is not available on the free tier for this project. Enable billing on the Google Cloud project that owns the API key, then try again.`;
    case "quota_exhausted":
      return "This Google project has used up its Gemini quota. Wait for the quota to reset, or raise it by enabling or increasing billing in Google AI Studio.";
    case "rate_limited":
      return "Google is rate limiting this project. Wait a minute and try again.";
    case "voice_limit":
      return "The Google project has reached its limit of stored voices. Revoke cloned voices you no longer use, then try again.";
    case "location_unsupported":
      return "Google does not offer the Gemini API in the region this server is calling from.";
    case "model_unavailable":
      return `${input.model ? `The model "${input.model}"` : "The configured Gemini model"} is not available to this API key. Check GEMINI_TTS_MODEL.`;
    case "not_found":
      return "That Gemini voice no longer exists at Google. It may have been deleted or have expired.";
    case "request_rejected":
      return "Google rejected the request.";
    case "timeout":
      return `Google did not respond${input.timeoutSeconds ? ` within ${input.timeoutSeconds} seconds` : " in time"}. Try again.`;
    case "unreachable":
      return "This server could not reach Google. Check the network connection, then try again.";
    case "provider_outage":
      return `Google's service failed on its side${input.status ? ` (HTTP ${input.status})` : ""}. Nothing is wrong with your recordings or settings — try again shortly.`;
    case "unknown":
      return `Google refused the request${input.status ? ` (HTTP ${input.status})` : ""}.`;
  }
}

function classify(input: {
  status: number;
  googleStatus: string;
  text: string;
  operation?: GeminiOperation;
}): GeminiFailureReason {
  const { status, googleStatus } = input;
  const text = input.text.toLowerCase();

  if (/recorded phrase did(?:n.?t| not) match/.test(text))
    return "consent_mismatch";
  if (/consent/.test(text) && status < 500) return "consent_rejected";
  if (
    /api key not valid|api_key_invalid|api key expired|api_key_expired/.test(
      text,
    )
  )
    return "api_key_invalid";
  if (
    /service_disabled|has not been used in project|api has not been used|it is disabled|accessnotconfigured/.test(
      text,
    )
  )
    return "api_not_enabled";
  if (/location is not supported|user location/.test(text))
    return "location_unsupported";
  if (/credits are depleted|prepayment credits|credit balance/.test(text))
    return "credits_depleted";
  if (status === 429 || googleStatus === "RESOURCE_EXHAUSTED") {
    // A free-tier limit of zero means the model is simply not on the free
    // tier — waiting will not help, billing will.
    if (/limit:\s*0\b/.test(text)) return "billing_required";
    if (/voice/.test(text) && /limit|maximum/.test(text)) return "voice_limit";
    if (/quota/.test(text)) return "quota_exhausted";
    return "rate_limited";
  }
  if (/billing/.test(text)) return "billing_required";
  if (/(maximum|limit).*voices|voices.*(maximum|limit)/.test(text))
    return "voice_limit";
  if (
    /model/.test(text) &&
    (status === 404 || /not found|not supported|unknown model/.test(text))
  )
    return "model_unavailable";
  if (
    status === 401 ||
    status === 403 ||
    googleStatus === "PERMISSION_DENIED" ||
    googleStatus === "UNAUTHENTICATED"
  )
    return "permission_denied";
  if (status === 404) return "not_found";
  if (status >= 500) return "provider_outage";
  if (
    status === 400 &&
    /audio|sample|recording|duration|too short|too long|mime/.test(text)
  )
    return "recording_rejected";
  // Creating a voice sends nothing but the two recordings and a name, so an
  // unexplained refusal of that request is a refusal of the recordings.
  if (status === 400 && input.operation === "enroll")
    return "recording_rejected";
  if (status >= 400) return "request_rejected";
  return "unknown";
}

/** What was being attempted, which decides how an unexplained refusal reads. */
export type GeminiOperation = "enroll" | "synthesize" | "manage";

export function diagnoseGeminiFailure(input: {
  httpStatus: number;
  body: string;
  model?: string;
  operation?: GeminiOperation;
}): GeminiFailure {
  const error = parseErrorBody(input.body);
  const haystack = error ? JSON.stringify(error) : input.body.slice(0, 4_000);
  const unwrapped = unwrap(haystack);
  const declaredStatus =
    typeof error?.code === "number" ? error.code : input.httpStatus;
  const status = unwrapped.status ?? declaredStatus;
  const topMessage = typeof error?.message === "string" ? error.message : null;
  // The translation-error wrapper's own message says nothing; the unwrapped
  // one is what Google actually meant.
  const googleText = unwrapped.message ?? topMessage;
  const reason = classify({
    status,
    googleStatus: typeof error?.status === "string" ? error.status : "",
    text: `${googleText ?? ""} ${haystack}`,
    operation: input.operation,
  });

  return {
    reason,
    status,
    message: messageFor(reason, { status, model: input.model }),
    googleMessage:
      googleText && !SELF_EXPLANATORY.has(reason) ? scrub(googleText) : null,
    retriable: RETRIABLE.has(reason),
  };
}

/** A request that never got an answer: timed out, or never connected. */
export function diagnoseGeminiTransportFailure(
  error: unknown,
  timeoutSeconds?: number,
): GeminiFailure {
  const reason: GeminiFailureReason =
    error instanceof Error && error.name === "AbortError"
      ? "timeout"
      : "unreachable";
  return {
    reason,
    status: null,
    message: messageFor(reason, { status: null, timeoutSeconds }),
    googleMessage: null,
    retriable: true,
  };
}

export function geminiRequestError(
  failure: GeminiFailure,
  requestId: string | null = null,
): SpeechProviderRequestError {
  return new SpeechProviderRequestError({
    code: `GEMINI_${failure.reason.toUpperCase()}`,
    message: failure.message,
    status: failure.status,
    requestId,
    reason: failure.reason,
    providerMessage: failure.googleMessage,
    retriable: failure.retriable,
  });
}
