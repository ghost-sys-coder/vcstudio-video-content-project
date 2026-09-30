import { z } from "zod";

/**
 * How one scene should be delivered: its tone, its pacing, and the words to
 * lean on.
 *
 * Stored per scene version, because a script directs delivery scene by scene —
 * "curious, tense" for the hook, "staccato" for the domino steps — and the
 * voice preset carries one set of instructions for a whole project.
 */
export const MAX_VOICE_DIRECTION_LENGTH = 300;
export const MAX_VOICE_EMPHASIS_ENTRIES = 30;

export const sceneVoiceDirectionSchema = z.object({
  voiceTone: z.string().trim().max(MAX_VOICE_DIRECTION_LENGTH).default(""),
  voicePacing: z.string().trim().max(MAX_VOICE_DIRECTION_LENGTH).default(""),
  voiceEmphasis: z
    .array(z.string().trim().min(1).max(100))
    .max(MAX_VOICE_EMPHASIS_ENTRIES)
    .default([]),
});

export type SceneVoiceDirection = z.infer<typeof sceneVoiceDirectionSchema>;

export const EMPTY_VOICE_DIRECTION: SceneVoiceDirection = {
  voiceTone: "",
  voicePacing: "",
  voiceEmphasis: [],
};

/** A comma-separated line of words to stress, as people write it. */
export function parseEmphasisList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,;\n]/u)
        .map((entry) => entry.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/gu, ""))
        .filter((entry) => entry !== ""),
    ),
  ].slice(0, MAX_VOICE_EMPHASIS_ENTRIES);
}

export function hasVoiceDirection(direction: SceneVoiceDirection): boolean {
  return (
    direction.voiceTone.trim() !== "" ||
    direction.voicePacing.trim() !== "" ||
    direction.voiceEmphasis.length > 0
  );
}

/** Keeps the combined direction within what providers accept comfortably. */
const MAX_INSTRUCTIONS_LENGTH = 2_000;

/**
 * The delivery direction sent with a scene's narration.
 *
 * The preset's own instructions come first, as the voice's standing character;
 * the scene's direction follows and says what is particular to this moment. A
 * scene with no direction returns the preset's instructions unchanged, so
 * narration made before per-scene direction existed is requested exactly as
 * before.
 *
 * Emphasis is a request, not a guarantee: neither provider offers a control
 * that stresses a chosen word, so the words are named and the model decides.
 */
export function composeVoiceInstructions(input: {
  presetInstructions: string;
  direction: SceneVoiceDirection;
  /**
   * Phrases marked `[RAISE]…[/RAISE]` in the narration. Asked of the voice by
   * name, because the markers themselves are never sent.
   */
  raisedPhrases?: string[];
}): string {
  const preset = input.presetInstructions.trim();
  const raised = input.raisedPhrases ?? [];
  if (!hasVoiceDirection(input.direction) && raised.length === 0) return preset;

  const lines: string[] = [];
  const tone = input.direction.voiceTone.trim();
  const pacing = input.direction.voicePacing.trim();
  if (tone) lines.push(`Tone: ${tone.replace(/[.\s]+$/u, "")}.`);
  if (pacing) lines.push(`Pacing: ${pacing.replace(/[.\s]+$/u, "")}.`);
  if (input.direction.voiceEmphasis.length > 0)
    lines.push(
      `Put clear vocal emphasis on: ${input.direction.voiceEmphasis
        .map((word) => `"${word}"`)
        .join(", ")}.`,
    );
  if (raised.length > 0)
    lines.push(
      `Raise your voice on ${raised.map((phrase) => `"${phrase}"`).join(", ")}: noticeably louder, with rising intensity and conviction, as if driving the point home. Return to your normal level straight after.`,
    );
  const scene = `Deliver this scene as follows.\n${lines.join("\n")}`;
  return (preset ? `${preset}\n\n${scene}` : scene).slice(
    0,
    MAX_INSTRUCTIONS_LENGTH,
  );
}
