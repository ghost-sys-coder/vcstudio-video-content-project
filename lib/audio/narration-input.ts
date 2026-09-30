import {
  parseNarrationParts,
  type NarrationPart,
} from "@/lib/audio/narration-directives";

/**
 * Builds the text-to-speech input for a scene from its narration. This is the
 * audio equivalent of prompt construction: it normalizes whitespace, enforces
 * the provider input limit, and reports the billable character count. Kept pure
 * so it is deterministic and unit-testable.
 *
 * Pause markers such as `[PAUSE: 0.5s]` stay in `text`, which is what is stored
 * and fingerprinted, but are never spoken or billed: `parts` carries the
 * spoken runs and the silences between them, and `characterCount` counts only
 * the spoken characters.
 */

export class NarrationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NarrationInputError";
  }
}

export interface SceneNarrationInput {
  text: string;
  characterCount: number;
  parts: NarrationPart[];
}

export function buildSceneNarrationInput(input: {
  narrationText: string;
  maximumCharacters: number;
}): SceneNarrationInput {
  if (!Number.isInteger(input.maximumCharacters) || input.maximumCharacters < 1)
    throw new RangeError("Maximum characters must be a positive integer.");

  const text = input.narrationText.replace(/\s+/g, " ").trim();
  const parts = parseNarrationParts(text);
  const characterCount = parts.reduce(
    (total, part) => total + (part.kind === "speech" ? part.text.length : 0),
    0,
  );
  if (characterCount === 0)
    throw new NarrationInputError("This scene has no narration text to voice.");
  if (characterCount > input.maximumCharacters)
    throw new NarrationInputError(
      `Scene narration exceeds the ${input.maximumCharacters}-character audio limit.`,
    );

  return { text, characterCount, parts };
}
