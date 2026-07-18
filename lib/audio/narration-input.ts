/**
 * Builds the text-to-speech input for a scene from its narration. This is the
 * audio equivalent of prompt construction: it normalizes whitespace, enforces
 * the provider input limit, and reports the billable character count. Kept pure
 * so it is deterministic and unit-testable.
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
}

export function buildSceneNarrationInput(input: {
  narrationText: string;
  maximumCharacters: number;
}): SceneNarrationInput {
  if (!Number.isInteger(input.maximumCharacters) || input.maximumCharacters < 1)
    throw new RangeError("Maximum characters must be a positive integer.");

  const text = input.narrationText.replace(/\s+/g, " ").trim();
  if (text.length === 0)
    throw new NarrationInputError("This scene has no narration text to voice.");
  if (text.length > input.maximumCharacters)
    throw new NarrationInputError(
      `Scene narration exceeds the ${input.maximumCharacters}-character audio limit.`,
    );

  return { text, characterCount: text.length };
}
