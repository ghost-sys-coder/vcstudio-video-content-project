/** Human-readable runtime for an idea's suggested length. */
export function formatDurationLabel(seconds: number | null): string {
  if (seconds === null) return "Flexible length";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}
