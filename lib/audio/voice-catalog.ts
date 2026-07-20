import { z } from "zod";

/**
 * Fixed sample line every voice preview reads. Kept short and identical across
 * voices so a listener compares timbre, not content — and so the total set of
 * synthesizable previews is bounded (one clip per catalogued voice), letting
 * them be cached as shared system assets rather than billed per play.
 */
export const VOICE_PREVIEW_SAMPLE_TEXT =
  "Here's how this voice sounds reading your script. Clear, natural narration that keeps your audience listening from the first line to the last.";

export type VoiceOption = {
  id: string;
  label: string;
  description: string;
};

/**
 * The OpenAI text-to-speech voice catalogue offered for preview. This is a
 * fixed allow-list: previews may only be synthesized for these voices, which
 * structurally bounds preview cost. Supported by the default `gpt-4o-mini-tts`
 * model. Descriptions are brief, honest impressions, not guarantees.
 */
export const VOICE_OPTIONS: readonly VoiceOption[] = [
  { id: "alloy", label: "Alloy", description: "Neutral and balanced" },
  { id: "ash", label: "Ash", description: "Warm and expressive" },
  { id: "ballad", label: "Ballad", description: "Soft and emotive" },
  { id: "coral", label: "Coral", description: "Bright and friendly" },
  { id: "echo", label: "Echo", description: "Calm and measured" },
  { id: "fable", label: "Fable", description: "Expressive storyteller" },
  { id: "nova", label: "Nova", description: "Warm and energetic" },
  { id: "onyx", label: "Onyx", description: "Deep and authoritative" },
  { id: "sage", label: "Sage", description: "Gentle and thoughtful" },
  { id: "shimmer", label: "Shimmer", description: "Light and upbeat" },
  { id: "verse", label: "Verse", description: "Versatile and dynamic" },
] as const;

export const VOICE_PREVIEW_IDS = VOICE_OPTIONS.map((voice) => voice.id);

export const voicePreviewVoiceSchema = z.enum(
  VOICE_PREVIEW_IDS as [string, ...string[]],
);

export function isPreviewVoice(value: string): boolean {
  return VOICE_PREVIEW_IDS.includes(value);
}

export const DEFAULT_PREVIEW_VOICE_ID = VOICE_OPTIONS[0].id;
