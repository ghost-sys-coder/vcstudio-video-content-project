"use client";

import { CaptionsIcon } from "lucide-react";
import { SubtitleSegmentList } from "@/components/subtitles/SubtitleSegmentList";
import type {
  SaveSubtitleSegmentHandler,
  SubtitleSegmentView,
} from "@/lib/subtitles/subtitle-view";

/**
 * Lists the derived caption segments and lets editors override individual cue
 * text. Timing is never hand-edited: it is recomputed deterministically from
 * approved narration audio, so only the words are editable here.
 */
export function SubtitleEditor({
  segments,
  canManage,
  onSave,
}: {
  segments: SubtitleSegmentView[];
  canManage: boolean;
  onSave: SaveSubtitleSegmentHandler;
}) {
  return (
    <section aria-label="Caption segments" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Caption segments</h2>
        <span className="text-xs text-muted-foreground">
          {segments.length} cue{segments.length === 1 ? "" : "s"}
        </span>
      </div>

      {segments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <CaptionsIcon aria-hidden className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No captions yet</p>
          <p className="mx-auto max-w-md text-xs text-muted-foreground">
            Captions are generated from approved scene narration audio. Generate
            and approve narration on the Audio tab, then return here to review,
            edit, and export the subtitle track.
          </p>
        </div>
      ) : (
        <SubtitleSegmentList
          canManage={canManage}
          onSave={onSave}
          segments={segments}
        />
      )}
    </section>
  );
}
