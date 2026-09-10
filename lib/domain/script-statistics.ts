import { extractNarration } from "@/lib/domain/script-structure";

export type ScriptStatisticsValue = {
  /** Characters in the document as written, including any direction. */
  characterCount: number;
  /** Words in the document as written, including any direction. */
  wordCount: number;
  /**
   * Words that are actually spoken. Equal to `wordCount` for an ordinary
   * script; lower when the document carries production direction.
   */
  narrationWordCount: number;
  /**
   * Runtime at 150 words per minute, counting spoken words only.
   *
   * A pasted script often carries [VISUAL] and [TEXT OVERLAY] direction that is
   * never read aloud. Counting it would overstate the runtime of exactly the
   * scripts most likely to be long, so the estimate follows the narration.
   */
  estimatedNarrationDurationSeconds: number;
};

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function calculateScriptStatistics(
  content: string,
): ScriptStatisticsValue {
  const wordCount = countWords(content);
  const narrationWordCount = countWords(extractNarration(content));
  return {
    characterCount: content.length,
    wordCount,
    narrationWordCount,
    estimatedNarrationDurationSeconds: Math.ceil(
      (narrationWordCount / 150) * 60,
    ),
  };
}
