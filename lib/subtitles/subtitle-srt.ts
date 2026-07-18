import { wrapCaptionLines } from "@/lib/subtitles/subtitle-segmentation";
import { formatTimestamp } from "@/lib/subtitles/subtitle-time";
import type { SubtitleTrack } from "@/lib/subtitles/subtitle-track";

/**
 * Serializes a subtitle track to SubRip (`.srt`). Cues are numbered from 1 and
 * separated by a blank line, using `HH:MM:SS,mmm` timestamps. Caption text is
 * wrapped to `maxLineCharacters` at word boundaries.
 */
export function formatSrt(
  track: SubtitleTrack,
  options: { maxLineCharacters: number },
): string {
  const blocks = track.segments.map((segment, index) => {
    const start = formatTimestamp(segment.startMilliseconds, ",");
    const end = formatTimestamp(segment.endMilliseconds, ",");
    const text = wrapCaptionLines(segment.text, options.maxLineCharacters);
    return `${index + 1}\n${start} --> ${end}\n${text}`;
  });
  // SubRip files conventionally end with a trailing newline.
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}
