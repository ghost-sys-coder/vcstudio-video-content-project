/**
 * Pure parsing of `ffprobe -print_format json -show_format -show_streams`
 * output into an integer millisecond duration. Kept separate from process
 * execution so it can be unit-tested without the ffprobe binary.
 */

export interface FfprobeDurationResult {
  durationMilliseconds: number;
}

function parseSeconds(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Extracts the media duration in whole milliseconds. Prefers the container
 * `format.duration` and falls back to the longest stream duration. Returns null
 * when no usable duration is present so callers can treat it as "unknown"
 * without discarding already-generated audio.
 */
export function parseFfprobeDurationMilliseconds(
  rawJson: string,
): FfprobeDurationResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  const root = readObject(parsed);
  if (!root) return null;

  const candidates: number[] = [];
  const formatSeconds = parseSeconds(readObject(root.format)?.duration);
  if (formatSeconds !== null) candidates.push(formatSeconds);

  if (Array.isArray(root.streams))
    for (const stream of root.streams) {
      const streamSeconds = parseSeconds(readObject(stream)?.duration);
      if (streamSeconds !== null) candidates.push(streamSeconds);
    }

  if (candidates.length === 0) return null;
  const seconds = Math.max(...candidates);
  return { durationMilliseconds: Math.round(seconds * 1000) };
}
