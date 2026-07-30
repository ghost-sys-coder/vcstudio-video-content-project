const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;
const STEP = 1024;

/**
 * Human-readable file size. Used in upload limit messages and the media library,
 * so it favours short round numbers over precision: 25 MB, not 25.00 MB.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  let value = bytes;
  let unitIndex = 0;
  while (value >= STEP && unitIndex < UNITS.length - 1) {
    value /= STEP;
    unitIndex += 1;
  }
  const rounded =
    value >= 10 || unitIndex === 0
      ? Math.round(value)
      : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[unitIndex]}`;
}
