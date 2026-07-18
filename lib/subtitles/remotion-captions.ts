import type { SubtitleTrack } from "@/lib/subtitles/subtitle-track";

/**
 * Caption cue consumed by the Phase 9 Remotion composition. Both absolute
 * millisecond and absolute frame boundaries are provided so the renderer never
 * has to re-derive frames (avoiding rounding drift).
 */
export interface RemotionCaption {
  text: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
}

export function toRemotionCaptions(track: SubtitleTrack): RemotionCaption[] {
  return track.segments.map((segment) => ({
    text: segment.text,
    startMs: segment.startMilliseconds,
    endMs: segment.endMilliseconds,
    startFrame: segment.startFrame,
    endFrame: segment.endFrame,
  }));
}
