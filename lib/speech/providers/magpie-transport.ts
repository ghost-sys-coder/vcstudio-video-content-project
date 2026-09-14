import "server-only";

import { SpeechProviderRequestError } from "@/lib/speech/speech-provider";

/**
 * How a Magpie request reaches NVIDIA, kept separate from what a Magpie request
 * *is*.
 *
 * NVIDIA offers the same model down two very different wires. A Speech NIM you
 * run yourself exposes a documented multipart REST endpoint. The hosted free
 * endpoint on build.nvidia.com is an NVIDIA Cloud Function, and Riva functions
 * there are documented as gRPC, which needs generated protobuf stubs rather
 * than a `fetch`.
 *
 * Only the wire differs — the parameters, the reference clip and the returned
 * WAV are identical — so the wire is a seam of its own. Swapping in a gRPC
 * transport later changes nothing about the provider, the voice model, or any
 * caller.
 */

export interface MagpieSynthesisCall {
  text: string;
  language: string;
  /** Catalogue voice, when not cloning from a reference clip. */
  voice?: string;
  sampleRateHz: number;
  /** 1–40. NVIDIA's default is 20. */
  promptQuality: number;
  /** The reference clip to clone, as a 16-bit mono WAV. */
  audioPrompt?: { bytes: Buffer; transcript?: string };
}

export interface MagpieSynthesisResponse {
  /** A complete WAV file, which is the only thing this endpoint returns. */
  bytes: Buffer;
  requestId: string | null;
}

export interface MagpieTransport {
  synthesize(call: MagpieSynthesisCall): Promise<MagpieSynthesisResponse>;
}

/**
 * The documented Speech NIM REST contract:
 * `POST {baseUrl}/v1/audio/synthesize`, multipart, answering `audio/wav`.
 *
 * Headers are supplied rather than assumed. A NIM inside your own network wants
 * none; a request routed through NVIDIA Cloud Functions wants a bearer token
 * and a function id. Neither is baked in, so one transport serves both.
 */
export class MagpieHttpTransport implements MagpieTransport {
  constructor(
    private readonly input: {
      baseUrl: string;
      headers?: Record<string, string>;
      timeoutMilliseconds?: number;
      fetcher?: typeof fetch;
    },
  ) {
    if (!input.baseUrl.trim())
      throw new RangeError("A Magpie base URL is required.");
  }

  async synthesize(
    call: MagpieSynthesisCall,
  ): Promise<MagpieSynthesisResponse> {
    const form = new FormData();
    form.set("text", call.text);
    form.set("language", call.language);
    form.set("sample_rate_hz", String(call.sampleRateHz));
    // The endpoint documents LINEAR_PCM as the only supported encoding, so it
    // is stated rather than left to a default that may change.
    form.set("encoding", "LINEAR_PCM");
    form.set("prompt_quality", String(call.promptQuality));
    if (call.voice) form.set("voice", call.voice);
    if (call.audioPrompt) {
      form.set(
        "audio_prompt",
        new Blob([new Uint8Array(call.audioPrompt.bytes)], {
          type: "audio/wav",
        }),
        "reference.wav",
      );
      if (call.audioPrompt.transcript)
        form.set("audio_prompt_transcript", call.audioPrompt.transcript);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.input.timeoutMilliseconds ?? 180_000,
    );

    let response: Response;
    try {
      response = await (this.input.fetcher ?? fetch)(
        `${this.input.baseUrl.replace(/\/+$/, "")}/v1/audio/synthesize`,
        {
          method: "POST",
          headers: this.input.headers,
          body: form,
          signal: controller.signal,
        },
      );
    } catch (error) {
      throw new SpeechProviderRequestError({
        code:
          error instanceof Error && error.name === "AbortError"
            ? "MAGPIE_TIMEOUT"
            : "MAGPIE_UNREACHABLE",
        message:
          error instanceof Error
            ? error.message
            : "The request did not complete.",
      });
    } finally {
      clearTimeout(timeout);
    }

    const requestId =
      response.headers.get("nvcf-reqid") ??
      response.headers.get("x-request-id");

    if (!response.ok) {
      // The body may echo the submitted text, so it is read for a status code's
      // worth of meaning and then discarded rather than stored or surfaced.
      await response.text().catch(() => "");
      throw new SpeechProviderRequestError({
        code: `MAGPIE_HTTP_${response.status}`,
        message: describeStatus(response.status),
        requestId,
        status: response.status,
      });
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0)
      throw new SpeechProviderRequestError({
        code: "MAGPIE_EMPTY_AUDIO",
        message: "The provider returned no audio.",
        requestId,
      });

    return { bytes, requestId };
  }
}

/**
 * Status codes turned into something an operator can act on.
 *
 * 403 is called out by name because it is the expected answer for an account
 * that has not been granted the gated Zeroshot model, and it is the one failure
 * no amount of re-recording will fix.
 */
function describeStatus(status: number): string {
  if (status === 401) return "The NVIDIA API key was rejected.";
  if (status === 403)
    return "This NVIDIA account is not approved for the zero-shot voice model.";
  if (status === 404) return "The configured NVIDIA endpoint was not found.";
  if (status === 429) return "NVIDIA is rate limiting requests right now.";
  if (status >= 500) return "NVIDIA could not complete the request.";
  return "NVIDIA rejected the request.";
}
