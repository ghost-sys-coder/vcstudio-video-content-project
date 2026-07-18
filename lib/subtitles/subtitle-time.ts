function pad(value: number, length: number): string {
  return value.toString().padStart(length, "0");
}

/**
 * Formats an absolute millisecond value as `HH:MM:SS<separator>mmm`. SRT uses a
 * comma separator; WebVTT uses a period.
 */
export function formatTimestamp(
  totalMilliseconds: number,
  separator: "," | ".",
): string {
  const clamped = Math.max(0, Math.round(totalMilliseconds));
  const milliseconds = clamped % 1000;
  const totalSeconds = Math.floor(clamped / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${separator}${pad(
    milliseconds,
    3,
  )}`;
}
