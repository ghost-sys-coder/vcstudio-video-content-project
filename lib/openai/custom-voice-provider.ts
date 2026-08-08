import "server-only";

import { z } from "zod";

const voiceConsentResponseSchema = z.object({
  id: z.string().min(1),
});

const customVoiceResponseSchema = z.object({
  id: z.string().min(1),
});

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

  private async request(path: string, formData: FormData): Promise<unknown> {
    const response = await (this.input.fetcher ?? fetch)(
      `${this.input.baseUrl ?? "https://api.openai.com/v1"}${path}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.input.apiKey}` },
        body: formData,
      },
    );
    if (!response.ok) throw new Error(`OPENAI_CUSTOM_VOICE_${response.status}`);
    return response.json();
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
    const response = await (this.input.fetcher ?? fetch)(
      `${this.input.baseUrl ?? "https://api.openai.com/v1"}/audio/voice_consents/${encodeURIComponent(consentId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.input.apiKey}` },
      },
    );
    if (!response.ok && response.status !== 404)
      throw new Error(`OPENAI_VOICE_CONSENT_DELETE_${response.status}`);
  }
}
