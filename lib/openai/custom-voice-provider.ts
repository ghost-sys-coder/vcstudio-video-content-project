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

function failureFromStatus(status: number): CustomVoiceProviderFailure {
  if (status === 404 || status === 403 || status === 405)
    return "provider_unavailable";
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
      const body = await response.text().catch(() => "");
      throw new CustomVoiceProviderError(
        failureFromStatus(response.status),
        response.status,
        providerMessage(body),
        response.headers.get("x-request-id"),
      );
    }
    return response.json();
  }

  /**
   * Probes whether this account can enroll custom voices, so the UI can refuse
   * to collect recordings it cannot use.
   */
  async checkAvailability(): Promise<CustomVoiceAvailability> {
    const response = await this.send("/audio/voices", { method: "GET" }).catch(
      (error: unknown) => error,
    );
    if (!(response instanceof Response))
      return availabilityFromFailure("provider_error");
    if (response.ok) return { status: "available", detail: "" };
    return availabilityFromFailure(failureFromStatus(response.status));
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
    if (!response.ok && response.status !== 404)
      throw new CustomVoiceProviderError(
        failureFromStatus(response.status),
        response.status,
        null,
        response.headers.get("x-request-id"),
      );
  }
}
