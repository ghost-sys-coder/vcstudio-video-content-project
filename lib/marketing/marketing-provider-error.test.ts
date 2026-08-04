import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import { classifyMarketingProviderError } from "@/lib/marketing/marketing-provider-error";

describe("classifyMarketingProviderError", () => {
  it("treats a rate limit as retriable and unbilled", () => {
    // Refused at the door, before any tokens were processed — releasing the
    // reservation here is correct, not optimistic.
    const failure = classifyMarketingProviderError(
      new OpenAI.RateLimitError(429, undefined, "busy", new Headers()),
    );
    expect(failure).toMatchObject({
      category: "rate_limit",
      retriable: true,
      mayHaveBilled: false,
    });
  });

  it("assumes a timeout was billed", () => {
    const failure = classifyMarketingProviderError(
      new OpenAI.APIConnectionTimeoutError({ message: "timed out" }),
    );
    expect(failure).toMatchObject({
      category: "timeout",
      retriable: true,
      mayHaveBilled: true,
    });
  });

  it("assumes an unparseable response was billed", () => {
    // The model ran; only the shape of what came back was wrong.
    expect(
      classifyMarketingProviderError(new Error("OPENAI_INVALID_RESPONSE")),
    ).toMatchObject({
      category: "invalid_response",
      retriable: false,
      mayHaveBilled: true,
    });
  });

  it("defaults an unknown failure to billed", () => {
    // Under-recording real spend lets the next operation past a budget it
    // should have failed; over-recording only shows a number slightly high.
    expect(
      classifyMarketingProviderError(new Error("who knows")),
    ).toMatchObject({ category: "provider_error", mayHaveBilled: true });
  });

  it("never surfaces scene-analysis wording to a marketing user", () => {
    const messages = [
      new OpenAI.APIConnectionTimeoutError({ message: "t" }),
      new Error("OPENAI_INVALID_RESPONSE"),
      new Error("unknown"),
    ].map((error) => classifyMarketingProviderError(error).message);
    for (const message of messages)
      expect(message.toLowerCase()).not.toContain("scene analysis");
  });

  it("always produces a non-empty safe message", () => {
    expect(
      classifyMarketingProviderError(new Error("x")).message.length,
    ).toBeGreaterThan(0);
  });
});
