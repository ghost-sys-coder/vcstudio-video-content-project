import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { MagpieHttpTransport } from "@/lib/speech/providers/magpie-transport";
import { SpeechProviderRequestError } from "@/lib/speech/speech-provider";

function wavResponse(body = "RIFFfake", init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "audio/wav" },
    ...init,
  });
}

function call(overrides: Record<string, unknown> = {}) {
  return {
    text: "Inflation is quietly reshaping your savings.",
    language: "en-US",
    sampleRateHz: 22_050,
    promptQuality: 20,
    ...overrides,
  };
}

describe("MagpieHttpTransport", () => {
  it("posts multipart form data to the documented synthesize path", async () => {
    const fetcher = vi.fn(async () => wavResponse());
    await new MagpieHttpTransport({
      baseUrl: "https://nim.example",
      fetcher: fetcher as unknown as typeof fetch,
    }).synthesize(call());

    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://nim.example/v1/audio/synthesize");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("does not double the slash when the base URL has a trailing one", async () => {
    const fetcher = vi.fn(async () => wavResponse());
    await new MagpieHttpTransport({
      baseUrl: "https://nim.example/",
      fetcher: fetcher as unknown as typeof fetch,
    }).synthesize(call());
    expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      "https://nim.example/v1/audio/synthesize",
    );
  });

  it("sends the documented fields, including the only supported encoding", async () => {
    const fetcher = vi.fn(async () => wavResponse());
    await new MagpieHttpTransport({
      baseUrl: "https://nim.example",
      fetcher: fetcher as unknown as typeof fetch,
    }).synthesize(call());

    const body = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as FormData;
    expect(body.get("text")).toBe(
      "Inflation is quietly reshaping your savings.",
    );
    expect(body.get("language")).toBe("en-US");
    expect(body.get("encoding")).toBe("LINEAR_PCM");
    expect(body.get("sample_rate_hz")).toBe("22050");
    expect(body.get("prompt_quality")).toBe("20");
  });

  it("attaches the reference clip as a WAV file when cloning", async () => {
    const fetcher = vi.fn(async () => wavResponse());
    await new MagpieHttpTransport({
      baseUrl: "https://nim.example",
      fetcher: fetcher as unknown as typeof fetch,
    }).synthesize(call({ audioPrompt: { bytes: Buffer.from("clip") } }));

    const body = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as FormData;
    const prompt = body.get("audio_prompt");
    expect(prompt).toBeInstanceOf(Blob);
    expect((prompt as Blob).type).toBe("audio/wav");
  });

  it("omits the clip entirely for a catalogue voice", async () => {
    const fetcher = vi.fn(async () => wavResponse());
    await new MagpieHttpTransport({
      baseUrl: "https://nim.example",
      fetcher: fetcher as unknown as typeof fetch,
    }).synthesize(call({ voice: "Magpie-ZeroShot-Multilingual.Male" }));

    const body = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as FormData;
    expect(body.get("audio_prompt")).toBeNull();
    expect(body.get("voice")).toBe("Magpie-ZeroShot-Multilingual.Male");
  });

  // A NIM inside your own network authenticates nothing, and an empty bearer
  // token turns a working setup into a 401.
  it("sends no headers when the deployment has no credentials", async () => {
    const fetcher = vi.fn(async () => wavResponse());
    await new MagpieHttpTransport({
      baseUrl: "https://nim.example",
      fetcher: fetcher as unknown as typeof fetch,
    }).synthesize(call());
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toBeUndefined();
  });

  it("passes through the cloud function headers when it has them", async () => {
    const fetcher = vi.fn(async () => wavResponse());
    await new MagpieHttpTransport({
      baseUrl: "https://api.nvcf.nvidia.com",
      headers: { Authorization: "Bearer nvapi-x", "function-id": "fn-1" },
      fetcher: fetcher as unknown as typeof fetch,
    }).synthesize(call());
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({ "function-id": "fn-1" });
  });

  it("returns the audio and the request id for support", async () => {
    const fetcher = vi.fn(async () =>
      wavResponse("RIFFfake", { headers: { "nvcf-reqid": "abc-123" } }),
    );
    const result = await new MagpieHttpTransport({
      baseUrl: "https://nim.example",
      fetcher: fetcher as unknown as typeof fetch,
    }).synthesize(call());
    expect(result.bytes.toString()).toBe("RIFFfake");
    expect(result.requestId).toBe("abc-123");
  });

  // The one failure no amount of re-recording will fix, so it says so instead
  // of reading like a bad request.
  it("explains a refusal for an account without the gated model", async () => {
    const fetcher = vi.fn(async () => new Response("denied", { status: 403 }));
    await expect(
      new MagpieHttpTransport({
        baseUrl: "https://nim.example",
        fetcher: fetcher as unknown as typeof fetch,
      }).synthesize(call()),
    ).rejects.toThrow(/not approved/i);
  });

  it("never leaks the provider body, which echoes the submitted text", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("submitted text: a company secret", { status: 400 }),
    );
    const error = await new MagpieHttpTransport({
      baseUrl: "https://nim.example",
      fetcher: fetcher as unknown as typeof fetch,
    })
      .synthesize(call())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SpeechProviderRequestError);
    expect((error as Error).message).not.toContain("company secret");
  });

  it("treats an empty body as a failure rather than silent silence", async () => {
    const fetcher = vi.fn(async () => wavResponse(""));
    await expect(
      new MagpieHttpTransport({
        baseUrl: "https://nim.example",
        fetcher: fetcher as unknown as typeof fetch,
      }).synthesize(call()),
    ).rejects.toThrow(/no audio/i);
  });

  it("reports an unreachable endpoint as such", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const error = await new MagpieHttpTransport({
      baseUrl: "https://nim.example",
      fetcher: fetcher as unknown as typeof fetch,
    })
      .synthesize(call())
      .catch((caught: unknown) => caught);
    expect((error as SpeechProviderRequestError).code).toBe(
      "MAGPIE_UNREACHABLE",
    );
  });

  it("refuses to be built without somewhere to send requests", () => {
    expect(() => new MagpieHttpTransport({ baseUrl: "   " })).toThrow(
      RangeError,
    );
  });
});
