import { describe, expect, it, vi } from "vitest";

import {
  backoffDelayMs,
  createRetryingFetch,
  isNeverSentError,
} from "@/db/connect-retry";

function connectTimeout(): Error {
  // The shape undici actually throws: a TypeError whose cause chain carries the
  // code two levels down.
  const inner = Object.assign(new Error("Connect Timeout Error"), {
    code: "UND_ERR_CONNECT_TIMEOUT",
  });
  const middle = Object.assign(new Error("fetch failed"), { cause: inner });
  return Object.assign(new TypeError("Error connecting to database"), {
    cause: middle,
  });
}

const noSleep = async () => {};

describe("isNeverSentError", () => {
  it("recognises a connect timeout nested in a cause chain", () => {
    expect(isNeverSentError(connectTimeout())).toBe(true);
  });

  it("recognises DNS and refusal failures", () => {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"])
      expect(isNeverSentError(Object.assign(new Error("x"), { code }))).toBe(
        true,
      );
  });

  it("does NOT treat ECONNRESET as never-sent", () => {
    // The whole safety argument: a reset can arrive after the request was
    // written, so the statement may have run. Retrying it could execute a
    // write twice.
    expect(
      isNeverSentError(
        Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
      ),
    ).toBe(false);
  });

  it("does not treat an ordinary error as never-sent", () => {
    expect(isNeverSentError(new Error("syntax error at or near"))).toBe(false);
    expect(isNeverSentError(null)).toBe(false);
    expect(isNeverSentError("nope")).toBe(false);
  });

  it("stops walking a self-referential cause chain", () => {
    const looping: { code: string; cause?: unknown } = { code: "NOPE" };
    looping.cause = looping;
    expect(isNeverSentError(looping)).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  it("grows with the attempt number", () => {
    const first = backoffDelayMs(1, 1000);
    const third = backoffDelayMs(3, 1000);
    // Jittered, so compare against the ranges rather than exact values.
    expect(first).toBeGreaterThanOrEqual(500);
    expect(first).toBeLessThanOrEqual(1500);
    expect(third).toBeGreaterThanOrEqual(2000);
  });

  it("jitters, so concurrent retries do not recreate the burst", () => {
    const samples = new Set(
      Array.from({ length: 40 }, () => backoffDelayMs(2, 1000)),
    );
    expect(samples.size).toBeGreaterThan(1);
  });
});

describe("createRetryingFetch", () => {
  it("returns the response when the first attempt succeeds", async () => {
    const response = new Response("ok");
    const inner = vi.fn(async () => response);
    const retrying = createRetryingFetch({
      fetchImplementation: inner as unknown as typeof fetch,
      sleep: noSleep,
    });
    await expect(retrying("https://example.test")).resolves.toBe(response);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("retries a connect timeout and succeeds", async () => {
    const response = new Response("ok");
    let calls = 0;
    const inner = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw connectTimeout();
      return response;
    });
    const retrying = createRetryingFetch({
      fetchImplementation: inner as unknown as typeof fetch,
      sleep: noSleep,
    });
    await expect(retrying("https://example.test")).resolves.toBe(response);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("gives up after the attempt limit and rethrows", async () => {
    const inner = vi.fn(async () => {
      throw connectTimeout();
    });
    const retrying = createRetryingFetch({
      attempts: 3,
      fetchImplementation: inner as unknown as typeof fetch,
      sleep: noSleep,
    });
    await expect(retrying("https://example.test")).rejects.toThrow(
      "Error connecting to database",
    );
    expect(inner).toHaveBeenCalledTimes(3);
  });

  it("never retries an error that might have been delivered", async () => {
    const inner = vi.fn(async () => {
      throw Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    });
    const retrying = createRetryingFetch({
      fetchImplementation: inner as unknown as typeof fetch,
      sleep: noSleep,
    });
    await expect(retrying("https://example.test")).rejects.toThrow(
      "socket hang up",
    );
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("does not retry an error response from the database", async () => {
    // A 400 means the server answered. Retrying would re-run the statement.
    const response = new Response("bad request", { status: 400 });
    const inner = vi.fn(async () => response);
    const retrying = createRetryingFetch({
      fetchImplementation: inner as unknown as typeof fetch,
      sleep: noSleep,
    });
    await expect(retrying("https://example.test")).resolves.toBe(response);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("passes the request and init through unchanged on every attempt", async () => {
    let calls = 0;
    const inner = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw connectTimeout();
      return new Response("ok");
    });
    const retrying = createRetryingFetch({
      fetchImplementation: inner as unknown as typeof fetch,
      sleep: noSleep,
    });
    const init = { method: "POST", body: "select 1" };
    await retrying("https://example.test/sql", init);
    expect(inner).toHaveBeenNthCalledWith(1, "https://example.test/sql", init);
    expect(inner).toHaveBeenNthCalledWith(2, "https://example.test/sql", init);
  });
});
