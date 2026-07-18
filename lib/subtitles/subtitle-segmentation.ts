/**
 * Deterministic subtitle text segmentation.
 *
 * These helpers only ever split narration *text*; they never invent word-level
 * timestamps. Timing is assigned later by distributing a scene's known audio
 * duration across the produced text chunks (see `subtitle-track.ts`).
 */

export function normalizeNarration(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Splits normalized prose into sentences at `.`, `!`, `?`, or `…` that are
 * followed by whitespace or the end of the string. Terminal punctuation is
 * retained with its sentence. Text with no terminal punctuation yields a single
 * sentence.
 */
export function splitIntoSentences(text: string): string[] {
  const normalized = normalizeNarration(text);
  if (!normalized) return [];

  const sentences: string[] = [];
  const pattern = /[^.!?…]*[.!?…]+(?=\s|$)|[^.!?…]+$/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    const chunk = match[0].trim();
    if (chunk) sentences.push(chunk);
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
  return sentences.length > 0 ? sentences : [normalized];
}

/**
 * Greedily wraps a chunk of text into pieces no longer than `maxCharacters`,
 * breaking only at word boundaries. A single word longer than the limit is kept
 * whole rather than split mid-word.
 */
export function chunkByLength(text: string, maxCharacters: number): string[] {
  const normalized = normalizeNarration(text);
  if (!normalized) return [];
  if (maxCharacters <= 0 || normalized.length <= maxCharacters)
    return [normalized];

  const words = normalized.split(" ");
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxCharacters) {
      current = `${current} ${word}`;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Produces the ordered text chunks for one scene.
 *
 * - `scene` granularity yields a single chunk containing the whole narration.
 * - `sentence` granularity yields one chunk per sentence, with over-long
 *   sentences further wrapped to `maxCaptionCharacters` for readability.
 */
export function buildSceneTextChunks(input: {
  narrationText: string;
  granularity: "scene" | "sentence";
  maxCaptionCharacters: number;
}): string[] {
  const normalized = normalizeNarration(input.narrationText);
  if (!normalized) return [];
  if (input.granularity === "scene") return [normalized];

  return splitIntoSentences(normalized).flatMap((sentence) =>
    chunkByLength(sentence, input.maxCaptionCharacters),
  );
}

/**
 * Inserts line breaks into caption text at word boundaries so exported cues and
 * rendered captions honor the configured maximum line length. Never splits a
 * word.
 */
export function wrapCaptionLines(
  text: string,
  maxLineCharacters: number,
): string {
  return chunkByLength(text, maxLineCharacters).join("\n");
}
