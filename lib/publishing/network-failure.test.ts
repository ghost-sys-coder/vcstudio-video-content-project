import { describe, expect, it } from "vitest";
import { isNeverSentNetworkError } from "@/lib/publishing/network-failure";

/** The shape Node produces: `TypeError: fetch failed` wrapping the real cause. */
function fetchFailure(code: string): Error {
  return Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("underlying"), { code }),
  });
}

describe("isNeverSentNetworkError", () => {
  it("treats a DNS failure as never sent", () => {
    expect(isNeverSentNetworkError(fetchFailure("ENOTFOUND"))).toBe(true);
    expect(isNeverSentNetworkError(fetchFailure("EAI_AGAIN"))).toBe(true);
  });

  it("treats a refused connection as never sent", () => {
    expect(isNeverSentNetworkError(fetchFailure("ECONNREFUSED"))).toBe(true);
  });

  it("treats a connect-phase timeout as never sent", () => {
    // The exact shape observed against an unreachable graph.facebook.com.
    expect(
      isNeverSentNetworkError(fetchFailure("UND_ERR_CONNECT_TIMEOUT")),
    ).toBe(true);
  });

  it("keeps a mid-flight socket death ambiguous", () => {
    // These can happen after the request bytes are on the wire, so the provider
    // may already have acted — retrying could double-post.
    expect(isNeverSentNetworkError(fetchFailure("ECONNRESET"))).toBe(false);
    expect(isNeverSentNetworkError(fetchFailure("ETIMEDOUT"))).toBe(false);
    expect(isNeverSentNetworkError(fetchFailure("UND_ERR_SOCKET"))).toBe(false);
  });

  it("reads a code on the error itself, not only on the cause", () => {
    expect(
      isNeverSentNetworkError(
        Object.assign(new Error("x"), { code: "ENOTFOUND" }),
      ),
    ).toBe(true);
  });

  it("stays ambiguous for anything unrecognised", () => {
    expect(isNeverSentNetworkError(new Error("boom"))).toBe(false);
    expect(isNeverSentNetworkError(null)).toBe(false);
    expect(isNeverSentNetworkError(undefined)).toBe(false);
    expect(isNeverSentNetworkError("ENOTFOUND")).toBe(false);
  });
});
