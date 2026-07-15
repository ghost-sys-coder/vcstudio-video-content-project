import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { classifyOpenAiError } from "@/lib/openai/openai-error";

describe("classifyOpenAiError", () => {
  it("allows bounded retries for timeouts", () => {
    expect(
      classifyOpenAiError(new OpenAI.APIConnectionTimeoutError()).retriable,
    ).toBe(true);
  });

  it("does not retry invalid structured output", () => {
    expect(classifyOpenAiError(new Error("OPENAI_INVALID_RESPONSE"))).toEqual({
      category: "invalid_response",
      message: "The AI response could not be validated.",
      retriable: false,
    });
  });
});
