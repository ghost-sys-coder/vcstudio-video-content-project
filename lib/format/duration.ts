/** Formats a millisecond duration as `m:ss` (or `h:mm:ss` past an hour). */
export function formatDurationMs(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  return `${minutes}:${paddedSeconds}`;
}
