"use client";

import { SubtitleSegmentRow } from "@/components/subtitles/SubtitleSegmentRow";
import type {
  SaveSubtitleSegmentHandler,
  SubtitleSegmentView,
} from "@/lib/subtitles/subtitle-view";

export function SubtitleSegmentList({
  segments,
  canManage,
  onSave,
}: {
  segments: SubtitleSegmentView[];
  canManage: boolean;
  onSave: SaveSubtitleSegmentHandler;
}) {
  return (
    <div className="space-y-2">
      {segments.map((segment) => (
        <SubtitleSegmentRow
          canManage={canManage}
          key={segment.key}
          onSave={onSave}
          segment={segment}
        />
      ))}
    </div>
  );
}
