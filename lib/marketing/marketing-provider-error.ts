import { classifyOpenAiError } from "@/lib/openai/openai-error";

export type MarketingProviderFailure = {
  category: string;
  message: string;
  retriable: boolean;
  /**
   * Whether the provider may already have run and billed the request.
   *
   * Drives whether the reservation reconciles at the reserved amount or is
   * released. Where the answer is genuinely unknown it is `true`: recording
   * spend that did not happen shows a workspace a number slightly too high,
   * while missing spend that did happen lets the next operation past a budget
   * it should have failed.
   */
  mayHaveBilled: boolean;
};

const MESSAGES: Record<string, string> = {
  timeout: "The AI service took too long to respond. Try again.",
  rate_limit: "The AI service is busy right now. Try again shortly.",
  invalid_response:
    "The AI returned a result that could not be read. Try again.",
  provider_error: "The AI service could not complete this request.",
};

const MAY_HAVE_BILLED: Record<string, boolean> = {
  // A rate limit is refused at the door, before any tokens are processed.
  rate_limit: false,
  // A timeout means the request was accepted and we stopped waiting; the model
  // very likely ran.
  timeout: true,
  // The model produced output — it just did not match the schema.
  invalid_response: true,
};

/**
 * Re-describes an OpenAI failure in Marketing Studio terms.
 *
 * `classifyOpenAiError` carries scene-analysis wording in its messages, which
 * would surface as "Scene analysis timed out" to somebody summarising a brand
 * document. The categories it derives are correct and reused; only the
 * user-facing sentence and the billing judgement are supplied here.
 */
export function classifyMarketingProviderError(
  error: unknown,
): MarketingProviderFailure {
  const failure = classifyOpenAiError(error);
  return {
    category: failure.category,
    message: MESSAGES[failure.category] ?? MESSAGES.provider_error!,
    retriable: failure.retriable,
    mayHaveBilled: MAY_HAVE_BILLED[failure.category] ?? true,
  };
}
