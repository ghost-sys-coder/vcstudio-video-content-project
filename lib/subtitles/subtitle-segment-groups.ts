import type { SubtitleSegmentView } from "@/lib/subtitles/subtitle-view";

export interface SubtitleSegmentGroup {
  sceneId: string;
  sceneNumber: number;
  segments: SubtitleSegmentView[];
  editedCount: number;
  longCount: number;
}

/**
 * Group caption cues by their originating scene, preserving the incoming order
 * of both scenes and cues. Segments arrive already sorted by scene then cue
 * index, so the first time a scene id is seen fixes that scene's position.
 *
 * This is pure so it can be unit tested and reused without a React runtime; the
 * accordion UI depends on the per-scene `editedCount` / `longCount` tallies to
 * flag which collapsed scenes still need attention.
 */
export function groupSegmentsByScene(
  segments: SubtitleSegmentView[],
): SubtitleSegmentGroup[] {
  const groups: SubtitleSegmentGroup[] = [];
  const indexBySceneId = new Map<string, number>();

  for (const segment of segments) {
    let position = indexBySceneId.get(segment.sceneId);
    if (position === undefined) {
      position = groups.length;
      indexBySceneId.set(segment.sceneId, position);
      groups.push({
        sceneId: segment.sceneId,
        sceneNumber: segment.sceneNumber,
        segments: [],
        editedCount: 0,
        longCount: 0,
      });
    }

    const group = groups[position]!;
    group.segments.push(segment);
    if (segment.isOverridden) group.editedCount += 1;
    if (segment.exceedsMaxDuration) group.longCount += 1;
  }

  return groups;
}
