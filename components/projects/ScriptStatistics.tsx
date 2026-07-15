import type { ScriptStatisticsValue } from "@/lib/domain/script-statistics";

export function ScriptStatistics({
  statistics,
  maximumCharacters,
}: {
  statistics: ScriptStatisticsValue;
  maximumCharacters: number;
}) {
  return (
    <div className="flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
      <span>
        {statistics.characterCount.toLocaleString()} /{" "}
        {maximumCharacters.toLocaleString()} characters
      </span>
      <span>{statistics.wordCount.toLocaleString()} words</span>
      <span>
        ~{Math.ceil(statistics.estimatedNarrationDurationSeconds / 60)} min
        narration
      </span>
    </div>
  );
}
