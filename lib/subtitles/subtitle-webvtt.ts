import { wrapCaptionLines } from "@/lib/subtitles/subtitle-segmentation";
import { formatTimestamp } from "@/lib/subtitles/subtitle-time";
import type { SubtitleTrack } from "@/lib/subtitles/subtitle-track";

/**
 * Serializes a subtitle track to WebVTT (`.vtt`). The file begins with the
 * required `WEBVTT` header, cues use `HH:MM:SS.mmm` timestamps, and caption text
 * is wrapped to `maxLineCharacters` at word boundaries.
 */
export function formatWebVtt(
  track: SubtitleTrack,
  options: { maxLineCharacters: number },
): string {
  const header = "WEBVTT";
  if (track.segments.length === 0) return `${header}\n`;

  const cues = track.segments.map((segment, index) => {
    const start = formatTimestamp(segment.startMilliseconds, ".");
    const end = formatTimestamp(segment.endMilliseconds, ".");
    const text = wrapCaptionLines(segment.text, options.maxLineCharacters);
    return `${index + 1}\n${start} --> ${end}\n${text}`;
  });
  return `${header}\n\n${cues.join("\n\n")}\n`;
}
