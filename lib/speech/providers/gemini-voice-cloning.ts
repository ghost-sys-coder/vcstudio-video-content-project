import "server-only";

import { z } from "zod";
import { SpeechProviderRequestError } from "@/lib/speech/speech-provider";

/**
 * Creating and managing voices replicated from a speaker's own recordings.
 *
 * **Enrolment, not zero-shot.** Google takes the reference and consent clips
 * once and returns a persistent identifier; afterwards the voice is named by
 * that id and the recordings are never sent again. So the shape matches the
 * OpenAI path rather than the Magpie one, which is why this lives beside the
 * synthesis provider instead of inside it — synthesis never needs these calls.
 *
 * **The consent clip is checked, not merely collected.** Google compares it
 * against the reference speaker and against its own mandated wording, so a
 * paraphrase fails the creation rather than passing unnoticed. The phrase is
 * carried on the provider's capability for exactly that reason.
 *
 * Recordings are sent as base64 in the request body. They are somebody's voice,
 * so nothing here logs them, echoes them back, or keeps them after the call.
 */

const voiceResponseSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  display_name: z.string().optional(),
  type: z.string().optional(),
});

const voiceListSchema = z.object({
  voices: z.array(voiceResponseSchema).optional(),
});

export interface ReplicatedVoice {
  /** `voice_…` when stored by Google, `voicekey_…` when held by us. */
  id: string;
  displayName: string | null;
  /** True when Google keeps it; false when it expires in seven days. */
  stored: boolean;
}

export interface VoiceRecording {
  bytes: Buffer;
  /** `audio/wav` for the 24 kHz mono 16-bit recordings Google prefers. */
  contentType: string;
}

export class GeminiVoiceCloningClient {
  constructor(
    private readonly input: {
      apiKey: string;
      model: string;
      baseUrl?: string;
      timeoutMilliseconds?: number;
      fetcher?: typeof fetch;
    },
  ) {
    if (!input.apiKey.trim())
      throw new RangeError("A Google Gemini API key is required.");
  }

  private get baseUrl(): string {
    return (
      this.input.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/+$/, "");
  }

  private async send(
    path: string,
    init: { method: string; body?: unknown },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.input.timeoutMilliseconds ?? 120_000,
    );
    let response: Response;
    try {
      response = await (this.input.fetcher ?? fetch)(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: {
          "x-goog-api-key": this.input.apiKey,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      throw new SpeechProviderRequestError({
        code:
          error instanceof Error && error.name === "AbortError"
            ? "GEMINI_TIMEOUT"
            : "GEMINI_UNREACHABLE",
        message:
          error instanceof Error
            ? error.message
            : "The request did not complete.",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // The body can echo the submitted audio and account detail, so it is
      // consumed for the status alone and then discarded.
      await response.text().catch(() => "");
      throw new SpeechProviderRequestError({
        code: `GEMINI_HTTP_${response.status}`,
        message: describeStatus(response.status),
        status: response.status,
      });
    }

    if (init.method === "DELETE") return null;
    return response.json();
  }

  /**
   * Replicates a speaker's voice from a reference clip and a consent clip.
   *
   * `store` decides who keeps it: Google for a year against a two-hundred voice
   * project limit, or nobody, in which case the returned key stops working
   * after seven days. Stored is the default because a voice that expires would
   * silently stop reproducing scenes that were narrated with it.
   */
  async createReplicatedVoice(input: {
    displayName: string;
    sourceAudio: VoiceRecording;
    consentAudio: VoiceRecording;
    store?: boolean;
  }): Promise<ReplicatedVoice> {
    const store = input.store ?? true;
    const parsed = voiceResponseSchema.parse(
      await this.send("/voices", {
        method: "POST",
        body: {
          store,
          voice: {
            model: this.input.model,
            type: "replicated",
            display_name: input.displayName,
            replicated: {
              source_audio: {
                mime_type: input.sourceAudio.contentType,
                data: input.sourceAudio.bytes.toString("base64"),
              },
              consent_audio: {
                mime_type: input.consentAudio.contentType,
                data: input.consentAudio.bytes.toString("base64"),
              },
            },
          },
        },
      }),
    );

    const id = parsed.id ?? parsed.key ?? stripVoiceName(parsed.name);
    if (!id)
      throw new SpeechProviderRequestError({
        code: "GEMINI_VOICE_ID_MISSING",
        message: "The voice was created but no identifier came back.",
      });

    return {
      id,
      displayName: parsed.display_name ?? input.displayName,
      stored: store,
    };
  }

  async listVoices(): Promise<ReplicatedVoice[]> {
    const parsed = voiceListSchema.parse(
      await this.send("/voices", { method: "GET" }),
    );
    return (parsed.voices ?? []).flatMap((voice) => {
      const id = voice.id ?? stripVoiceName(voice.name);
      if (!id) return [];
      return [
        {
          id,
          displayName: voice.display_name ?? null,
          stored: true,
        },
      ];
    });
  }

  /**
   * Forgets a voice at Google.
   *
   * A voice already gone is treated as deleted rather than as a failure: the
   * outcome the caller asked for is the outcome they have.
   */
  async deleteVoice(voiceId: string): Promise<void> {
    try {
      await this.send(`/voices/${encodeURIComponent(voiceId)}`, {
        method: "DELETE",
      });
    } catch (error) {
      if (error instanceof SpeechProviderRequestError && error.status === 404)
        return;
      throw error;
    }
  }
}

/** `voices/voice_abc` is the resource name; the bare id is what we store. */
function stripVoiceName(name: string | undefined): string | null {
  if (!name) return null;
  const last = name.split("/").pop();
  return last && last.length > 0 ? last : null;
}

function describeStatus(status: number): string {
  if (status === 400)
    return "Google rejected the recordings. The consent clip must recite the required statement, in the same voice and setting as the sample.";
  if (status === 401 || status === 403)
    return "The Google Gemini API key was rejected, or this project cannot create voices.";
  if (status === 404) return "That voice no longer exists at Google.";
  if (status === 429)
    return "Google is rate limiting requests, or this project has reached its voice limit.";
  if (status >= 500) return "Google could not complete the request.";
  return "Google refused the request.";
}
