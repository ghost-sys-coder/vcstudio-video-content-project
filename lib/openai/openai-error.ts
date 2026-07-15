import OpenAI from "openai";

export type OpenAiFailure = {
  category: string;
  message: string;
  retriable: boolean;
};

export function classifyOpenAiError(error: unknown): OpenAiFailure {
  if (error instanceof OpenAI.APIConnectionTimeoutError)
    return {
      category: "timeout",
      message: "Scene analysis timed out. Please try again.",
      retriable: true,
    };
  if (error instanceof OpenAI.RateLimitError)
    return {
      category: "rate_limit",
      message: "The AI service is busy. Please try again shortly.",
      retriable: true,
    };
  if (error instanceof Error && error.message === "OPENAI_INVALID_RESPONSE")
    return {
      category: "invalid_response",
      message: "The AI response could not be validated.",
      retriable: false,
    };
  return {
    category: "provider_error",
    message: "Scene analysis could not be completed.",
    retriable: false,
  };
}
