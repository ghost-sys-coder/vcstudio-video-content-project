import "server-only";

import { z } from "zod";
import {
  availabilityFromFailure,
  type CustomVoiceAvailability,
} from "@/lib/audio/custom-voice-availability";
import {
  CustomVoiceProviderError,
  type CustomVoiceProviderFailure,
} from "@/lib/domain/errors";

const voiceConsentResponseSchema = z.object({
  id: z.string().min(1),
});

const customVoiceResponseSchema = z.object({
  id: z.string().min(1),
});

const providerErrorSchema = z.object({
  error: z.object({ message: z.string().min(1) }).partial(),
});

/**
 * OpenAI returns 404 both for a route it does not recognize and for a real
 * route this organization is not allowlisted for, and only the body text
 * separates them — "Your organization does not have access to this endpoint."
 * versus "Endpoint not found." The difference decides whether the operator
 * should request access or change providers, so it is classified, not flattened.
 */
function failureFromResponse(
  status: number,
  message: string | null,
): CustomVoiceProviderFailure {
  const deniedForOrganization = message
    ? /does not have access|must be verified|not approved/i.test(message)
    : false;
  if (status === 403 || (status === 404 && deniedForOrganization))
    return "provider_not_enabled";
  if (status === 404 || status === 405) return "provider_unavailable";
  if (status === 401) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "recording_rejected";
  return "provider_error";
}

/**
 * The provider never returns the raw body to callers — it may echo prompt or
 * account detail — but the top-level `error.message` is the only place OpenAI
 * explains *which* input it rejected, so that one field is preserved.
 */
function providerMessage(body: string): string | null {
  try {
    const parsed = providerErrorSchema.safeParse(JSON.parse(body));
    return parsed.success ? (parsed.data.error.message ?? null) : null;
  } catch {
    return null;
  }
}

export class OpenAiCustomVoiceProvider {
  constructor(
    private readonly input: {
      apiKey: string;
      baseUrl?: string;
      fetcher?: typeof fetch;
    },
  ) {
    if (!input.apiKey.trim()) throw new Error("OPENAI_API_KEY_MISSING");
  }

  private get baseUrl(): string {
    return this.input.baseUrl ?? "https://api.openai.com/v1";
  }

  private async send(
    path: string,
    init: { method: string; body?: FormData },
  ): Promise<Response> {
    try {
      return await (this.input.fetcher ?? fetch)(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: { Authorization: `Bearer ${this.input.apiKey}` },
        body: init.body,
      });
    } catch (error) {
      throw new CustomVoiceProviderError(
        "provider_error",
        null,
        error instanceof Error ? error.message : null,
        null,
      );
    }
  }

  private async request(path: string, formData: FormData): Promise<unknown> {
    const response = await this.send(path, { method: "POST", body: formData });
    if (!response.ok) {
      const message = providerMessage(await response.text().catch(() => ""));
      throw new CustomVoiceProviderError(
        failureFromResponse(response.status, message),
        response.status,
        message,
        response.headers.get("x-request-id"),
      );
    }
    return response.json();
  }

  /**
   * Probes whether this account can enroll custom voices, so the UI can refuse
   * to collect recordings it cannot use.
   *
   * The probe is an empty POST to the consent endpoint rather than a GET: these
   * routes are POST-only, so a GET answers "Endpoint not found." even for an
   * organization that does have access, which would falsely block enrollment.
   * An empty body creates nothing — an allowlisted organization gets a 400 for
   * the missing parameters, which is itself the proof that access exists.
   */
  async checkAvailability(): Promise<CustomVoiceAvailability> {
    const response = await this.send("/audio/voice_consents", {
      method: "POST",
      body: new FormData(),
    }).catch((error: unknown) => error);
    if (!(response instanceof Response))
      return availabilityFromFailure("provider_error");
    if (response.ok || response.status === 400)
      return { status: "available", detail: "" };
    const message = providerMessage(await response.text().catch(() => ""));
    return availabilityFromFailure(
      failureFromResponse(response.status, message),
    );
  }

  async createConsent(input: {
    name: string;
    language: string;
    recording: File;
  }): Promise<string> {
    const formData = new FormData();
    formData.set("name", input.name);
    formData.set("language", input.language);
    formData.set("recording", input.recording);
    const parsed = voiceConsentResponseSchema.parse(
      await this.request("/audio/voice_consents", formData),
    );
    return parsed.id;
  }

  async createVoice(input: {
    name: string;
    consentId: string;
    sample: File;
  }): Promise<string> {
    const formData = new FormData();
    formData.set("name", input.name);
    formData.set("consent", input.consentId);
    formData.set("audio_sample", input.sample);
    const parsed = customVoiceResponseSchema.parse(
      await this.request("/audio/voices", formData),
    );
    return parsed.id;
  }

  async deleteConsent(consentId: string): Promise<void> {
    const response = await this.send(
      `/audio/voice_consents/${encodeURIComponent(consentId)}`,
      { method: "DELETE" },
    );
    if (!response.ok && response.status !== 404) {
      const message = providerMessage(await response.text().catch(() => ""));
      throw new CustomVoiceProviderError(
        failureFromResponse(response.status, message),
        response.status,
        message,
        response.headers.get("x-request-id"),
      );
    }
  }
}
