import "server-only";

import type { CustomVoiceAvailability } from "@/lib/audio/custom-voice-availability";
import {
  CustomVoiceProviderError,
  type CustomVoiceProviderFailure,
} from "@/lib/domain/errors";
import {
  getSceneAudioEnvironment,
  getSpeechProviderEnvironment,
} from "@/lib/env/server";
import { OpenAiCustomVoiceProvider } from "@/lib/openai/custom-voice-provider";
import {
  CUSTOM_VOICE_CONSENT_PHRASE,
  customVoiceAudioTypeFromMimeType,
  type SceneAudioFormat,
} from "@/lib/schemas/scene-audio";
import { GeminiVoiceCloningClient } from "@/lib/speech/providers/gemini-voice-cloning";
import { SpeechProviderRequestError } from "@/lib/speech/speech-provider";
import type { VoiceEnrollmentDetails } from "@/lib/speech/voice-enrollment-details";
import {
  GEMINI_CONSENT_PHRASE,
  GEMINI_SAMPLE_SECONDS,
} from "@/lib/speech/voice-cloning-capability";

/**
 * Cloning a voice, independent of who does the cloning.
 *
 * The enrolment routes used to construct OpenAI's client directly, so every
 * clone went to OpenAI whatever the deployment was configured for — and this
 * organisation is not approved for OpenAI custom voices. The routes now ask for
 * a provider and call it through this one shape.
 *
 * **Enrolment follows configuration; revocation follows the voice.** A new
 * voice is made with the configured provider. An existing voice is revoked by
 * the provider that made it, because only that provider holds it: a voice
 * cloned at OpenAI must be forgotten at OpenAI even after the deployment has
 * moved to Google.
 */

export type EnrollmentProviderId = "openai" | "gemini";

export interface EnrolledVoice {
  providerVoiceId: string;
  /** Null where consent is taken inside voice creation, as Google does. */
  providerConsentId: string | null;
}

export interface VoiceEnrollmentProvider {
  readonly details: VoiceEnrollmentDetails;
  /** What a preset made from one of this provider's voices narrates with. */
  readonly preset: { model: string; format: SceneAudioFormat };
  checkAvailability(): Promise<CustomVoiceAvailability>;
  enroll(input: {
    name: string;
    language: string;
    consent: File;
    sample: File;
  }): Promise<EnrolledVoice>;
  /** Undoes `enroll` when the voice cannot be saved locally. */
  discard(voice: EnrolledVoice): Promise<void>;
  /** Forgets a voice at the provider when the workspace revokes it. */
  revoke(voice: EnrolledVoice): Promise<void>;
}

/**
 * The provider new voices are enrolled with.
 *
 * Null for a zero-shot provider: Magpie keeps no voice at all, so there is
 * nothing for this flow to create. Offering it the OpenAI dialog instead would
 * enrol somewhere the deployment is not narrating.
 */
export function configuredEnrollmentProviderId(): EnrollmentProviderId | null {
  const configured = getSpeechProviderEnvironment().SPEECH_PROVIDER;
  return configured === "openai" || configured === "gemini" ? configured : null;
}

export function createVoiceEnrollmentProvider(
  id: string,
): VoiceEnrollmentProvider | null {
  if (id === "gemini") return createGeminiEnrollment();
  if (id === "openai") return createOpenAiEnrollment();
  return null;
}

function createOpenAiEnrollment(): VoiceEnrollmentProvider {
  const environment = getSceneAudioEnvironment();
  const client = new OpenAiCustomVoiceProvider({
    apiKey: environment.OPENAI_API_KEY,
  });
  return {
    details: {
      provider: "openai",
      consentPhrase: CUSTOM_VOICE_CONSENT_PHRASE,
      sample: { minimumSeconds: 30, maximumSeconds: 180 },
      recordingFormat: "any",
    },
    preset: {
      model: environment.OPENAI_TTS_MODEL,
      format: environment.OPENAI_TTS_FORMAT,
    },
    checkAvailability: () => client.checkAvailability(),
    async enroll(input) {
      const consentId = await client.createConsent({
        name: `${input.name} consent`,
        language: input.language,
        recording: input.consent,
      });
      try {
        const providerVoiceId = await client.createVoice({
          name: input.name,
          consentId,
          sample: input.sample,
        });
        return { providerVoiceId, providerConsentId: consentId };
      } catch (error) {
        // A consent record with no voice is invisible to the workspace and
        // cannot be removed later, so it is removed now.
        await client.deleteConsent(consentId).catch(() => undefined);
        throw error;
      }
    },
    async discard(voice) {
      if (voice.providerConsentId)
        await client.deleteConsent(voice.providerConsentId);
    },
    async revoke(voice) {
      if (voice.providerConsentId)
        await client.deleteConsent(voice.providerConsentId);
    },
  };
}

function createGeminiEnrollment(): VoiceEnrollmentProvider | null {
  const speech = getSpeechProviderEnvironment();
  if (!speech.GOOGLE_GEMINI_API_KEY) return null;
  const client = new GeminiVoiceCloningClient({
    apiKey: speech.GOOGLE_GEMINI_API_KEY,
    model: speech.GEMINI_TTS_MODEL,
    timeoutMilliseconds: speech.GEMINI_REQUEST_TIMEOUT_SECONDS * 1_000,
  });

  return {
    details: {
      provider: "gemini",
      consentPhrase: GEMINI_CONSENT_PHRASE,
      sample: GEMINI_SAMPLE_SECONDS,
      recordingFormat: "wav",
    },
    // Gemini answers in WAV and nothing else; a preset asking for mp3 would be
    // refused at narration time rather than now.
    preset: { model: speech.GEMINI_TTS_MODEL, format: "wav" },

    async checkAvailability() {
      // Listing voices is the cheapest call that proves the key works and the
      // project may hold voices. It creates nothing and costs nothing.
      try {
        await client.listVoices();
        return { status: "available", detail: "" };
      } catch (error) {
        const status =
          error instanceof SpeechProviderRequestError ? error.status : null;
        if (status === 401 || status === 403)
          return {
            status: "unauthorized",
            detail:
              "Google rejected this deployment's Gemini API key, or the project cannot hold custom voices. Check GOOGLE_GEMINI_API_KEY.",
          };
        return {
          status: "unknown",
          detail:
            "Google could not confirm voice cloning is available. Try again shortly.",
        };
      }
    },

    async enroll(input) {
      try {
        const voice = await client.createReplicatedVoice({
          displayName: input.name,
          sourceAudio: await recording(input.sample),
          consentAudio: await recording(input.consent),
        });
        return { providerVoiceId: voice.id, providerConsentId: null };
      } catch (error) {
        throw asCustomVoiceError(error);
      }
    },
    async discard(voice) {
      await client.deleteVoice(voice.providerVoiceId);
    },
    async revoke(voice) {
      await client.deleteVoice(voice.providerVoiceId);
    },
  };
}

async function recording(file: File) {
  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    // The bare type, without codec parameters, which is what Google expects.
    contentType: customVoiceAudioTypeFromMimeType(file.type) ?? file.type,
  };
}

/**
 * Carries a Google failure into the categories the enrolment messages already
 * understand, so a refused recording is not reported as a request that never
 * reached the provider.
 */
function asCustomVoiceError(error: unknown): unknown {
  if (!(error instanceof SpeechProviderRequestError)) return error;
  const failure: CustomVoiceProviderFailure =
    error.status === 400
      ? "recording_rejected"
      : error.status === 401 || error.status === 403
        ? "unauthorized"
        : error.status === 404
          ? "provider_unavailable"
          : error.status === 429
            ? "rate_limited"
            : "provider_error";
  return new CustomVoiceProviderError(
    failure,
    error.status,
    error.message,
    error.requestId,
  );
}
