export type ScriptStatisticsValue = {
  characterCount: number;
  wordCount: number;
  estimatedNarrationDurationSeconds: number;
};

export function calculateScriptStatistics(
  content: string,
): ScriptStatisticsValue {
  const trimmed = content.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/u).length : 0;
  return {
    characterCount: content.length,
    wordCount,
    estimatedNarrationDurationSeconds: Math.ceil((wordCount / 150) * 60),
  };
}
