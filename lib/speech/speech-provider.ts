import type { SceneAudioFormat } from "@/lib/schemas/scene-audio";
import type {
  SpeechProviderId,
  VoiceCloningCapability,
} from "@/lib/speech/voice-cloning-capability";

/**
 * The narrow seam every text-to-speech provider sits behind.
 *
 * It exists so that changing who speaks the narration is a configuration
 * change rather than a rewrite. The previous arrangement reached for OpenAI's
 * client directly from the worker, which meant the provider's shape — its voice
 * identifiers, its formats, its idea of what a custom voice even is — had
 * quietly become the application's shape.
 *
 * Deliberately narrow, per `AGENTS.md`: one call that turns text into bytes,
 * plus a declaration of what the provider can do about voices. No attempt at a
 * universal speech framework.
 */

/** Where the voice comes from, in the only three shapes that exist. */
export type SpeechVoiceSelection =
  /** A catalogue voice the provider already has. */
  | { kind: "built_in"; name: string }
  /** A voice the provider enrolled and stores itself. */
  | { kind: "enrolled"; providerVoiceId: string }
  /**
   * A voice cloned from a reference clip we hold. Sent in full with every
   * request, because a zero-shot model keeps nothing between calls.
   */
  | { kind: "zero_shot"; reference: SpeechVoiceReference };

export interface SpeechVoiceReference {
  bytes: Buffer;
  contentType: string;
  /** The words spoken in the clip, when the model requires them. */
  transcript?: string;
}

export interface SpeechSynthesisRequest {
  text: string;
  voice: SpeechVoiceSelection;
  format: SceneAudioFormat;
  /** 100 means the model's natural pace. */
  speedScaledPercent: number;
  /** BCP-47, e.g. `en-US`. Required by some providers, ignored by others. */
  language: string;
  /** Delivery direction, honoured only by providers that accept it. */
  instructions?: string;
  endUserId?: string;
}

export interface SpeechSynthesisResult {
  provider: SpeechProviderId;
  model: string;
  requestId: string | null;
  bytes: Buffer;
  contentType: string;
  format: SceneAudioFormat;
  characterCount: number;
  /** Safe to persist and show. Never carries credentials or raw provider bodies. */
  safeMetadata: Record<string, string | number | boolean | null>;
}

export interface SpeechProvider {
  readonly id: SpeechProviderId;
  /** What this provider can do about voices, read rather than assumed. */
  readonly capability: VoiceCloningCapability;
  /**
   * Longest text this provider accepts in one request, after normalization.
   * Stated because it differs sharply between providers and a caller that
   * assumes the largest will have narration rejected by the smallest.
   */
  readonly maximumCharacters: number;
  synthesize(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
}

/**
 * Raised when a provider cannot do what a request asks of it.
 *
 * Separate from a transport failure: this one is permanent for the request as
 * written, so retrying it unchanged only wastes time and, on a billable
 * provider, money.
 */
export class SpeechProviderUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeechProviderUnsupportedError";
  }
}

/** A provider request that failed in transit or was refused by the service. */
export class SpeechProviderRequestError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly status: number | null;

  constructor(input: {
    code: string;
    message: string;
    requestId?: string | null;
    status?: number | null;
  }) {
    super(input.message);
    this.name = "SpeechProviderRequestError";
    this.code = input.code;
    this.requestId = input.requestId ?? null;
    this.status = input.status ?? null;
  }
}
