import "server-only";

import { z } from "zod";
import {
  SpeechProviderRequestError,
  SpeechProviderUnsupportedError,
  type SpeechProvider,
  type SpeechSynthesisRequest,
  type SpeechSynthesisResult,
} from "@/lib/speech/speech-provider";
import {
  GEMINI_CONSENT_PHRASE,
  GEMINI_SAMPLE_SECONDS,
  type VoiceCloningCapability,
} from "@/lib/speech/voice-cloning-capability";

/**
 * Google Gemini speech, behind the shared seam.
 *
 * **Enrolled cloning.** A replicated voice is created once from a reference and
 * a consent recording and is named afterwards by a `voice_…` identifier, so
 * synthesis here never carries audio — only the id. Creating one is
 * `GeminiVoiceCloningClient`, deliberately a separate module, because nothing
 * in this path needs it.
 *
 * The response is a complete WAV at 24 kHz unless another container is asked
 * for, and the formats on offer are all uncompressed. A request for mp3 is
 * therefore refused rather than answered with mislabelled bytes.
 */

/** The only container this returns, matching the app's `wav` output format. */
const GEMINI_OUTPUT_FORMAT = "wav";

/** Google's documented default for unary speech. */
const GEMINI_SAMPLE_RATE_HZ = 24_000;

/**
 * Gemini accepts a long script, but narration is stored per scene and the
 * ceiling exists so an over-long scene is refused before a call is spent
 * rather than after. Set well above a plausible scene.
 */
export const GEMINI_MAXIMUM_CHARACTERS = 8_000;

const interactionSchema = z.object({
  steps: z
    .array(
      z.object({
        content: z
          .array(z.object({ data: z.string().optional() }).passthrough())
          .optional(),
      }),
    )
    .optional(),
});

export class GeminiSpeechProvider implements SpeechProvider {
  readonly id = "gemini" as const;
  readonly capability: VoiceCloningCapability = {
    kind: "enrolled",
    requiresConsentRecording: true,
    consentPhrase: GEMINI_CONSENT_PHRASE,
    sample: GEMINI_SAMPLE_SECONDS,
  };
  readonly maximumCharacters = GEMINI_MAXIMUM_CHARACTERS;

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

  async synthesize(
    request: SpeechSynthesisRequest,
  ): Promise<SpeechSynthesisResult> {
    const text = request.text.trim();
    if (text.length === 0)
      throw new RangeError("Audio narration text is required.");

    if (text.length > GEMINI_MAXIMUM_CHARACTERS)
      throw new SpeechProviderUnsupportedError(
        `This voice accepts ${GEMINI_MAXIMUM_CHARACTERS} characters at a time and the narration is ${text.length}. Split the scene or choose a different voice.`,
      );

    // Refused rather than answered in WAV: a caller expecting mp3 would store
    // the bytes under an mp3 key and hand the renderer a mislabelled file.
    if (request.format !== GEMINI_OUTPUT_FORMAT)
      throw new SpeechProviderUnsupportedError(
        `This voice can only produce WAV audio, and ${request.format} was requested.`,
      );

    if (request.voice.kind === "zero_shot")
      throw new SpeechProviderUnsupportedError(
        "This provider replicates a voice once and refers to it by name afterwards, rather than cloning from a recording on every request.",
      );

    // Speed is not a parameter this endpoint exposes; delivery is directed in
    // words instead. Accepting a number that changes nothing would leave a
    // creator adjusting a dead control.
    if (request.speedScaledPercent !== 100)
      throw new SpeechProviderUnsupportedError(
        "This voice does not support speed adjustment. Direct the delivery in the instructions instead.",
      );

    const voice =
      request.voice.kind === "enrolled"
        ? request.voice.providerVoiceId
        : request.voice.name;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.input.timeoutMilliseconds ?? 180_000,
    );

    let response: Response;
    try {
      response = await (this.input.fetcher ?? fetch)(
        `${this.baseUrl}/interactions`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": this.input.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.input.model,
            input: [
              {
                type: "user_input",
                content: [
                  {
                    type: "text",
                    text,
                    // Delivery direction rides with the line rather than in a
                    // separate field, which is how this API steers a read.
                    ...(request.instructions?.trim()
                      ? {
                          annotations: [
                            {
                              type: "speech_metadata",
                              style: request.instructions.trim(),
                            },
                          ],
                        }
                      : {}),
                  },
                ],
              },
            ],
            response_format: {
              type: "audio",
              mime_type: "audio/wav",
              sample_rate: GEMINI_SAMPLE_RATE_HZ,
            },
            generation_config: { speech_config: [{ voice }] },
            stream: false,
          }),
          signal: controller.signal,
        },
      );
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

    const requestId = response.headers.get("x-request-id");

    if (!response.ok) {
      await response.text().catch(() => "");
      throw new SpeechProviderRequestError({
        code: `GEMINI_HTTP_${response.status}`,
        message: describeStatus(response.status),
        requestId,
        status: response.status,
      });
    }

    const parsed = interactionSchema.parse(await response.json());
    const encoded = parsed.steps
      ?.flatMap((step) => step.content ?? [])
      .find(
        (part) => typeof part.data === "string" && part.data.length > 0,
      )?.data;

    if (!encoded)
      throw new SpeechProviderRequestError({
        code: "GEMINI_EMPTY_AUDIO",
        message: "The provider returned no audio.",
        requestId,
      });

    const bytes = Buffer.from(encoded, "base64");
    if (bytes.byteLength === 0)
      throw new SpeechProviderRequestError({
        code: "GEMINI_EMPTY_AUDIO",
        message: "The provider returned no audio.",
        requestId,
      });

    return {
      provider: "gemini",
      model: this.input.model,
      requestId,
      bytes,
      contentType: "audio/wav",
      format: GEMINI_OUTPUT_FORMAT,
      characterCount: text.length,
      safeMetadata: {
        // The voice identifier is a reference, not a recording, so it is safe
        // to keep beside the generation for support.
        voice,
        cloned: request.voice.kind === "enrolled",
        sampleRateHz: GEMINI_SAMPLE_RATE_HZ,
        characterCount: text.length,
        // Google watermarks every clip and adds provenance credentials to a
        // replicated one. Recorded so a finished asset's origin is traceable.
        watermarked: true,
      },
    };
  }
}

function describeStatus(status: number): string {
  if (status === 400)
    return "Google rejected the request. The voice may have been deleted or expired.";
  if (status === 401 || status === 403)
    return "The Google Gemini API key was rejected.";
  if (status === 404) return "That Gemini voice or model was not found.";
  if (status === 429) return "Google is rate limiting requests right now.";
  if (status >= 500) return "Google could not complete the request.";
  return "Google refused the request.";
}
