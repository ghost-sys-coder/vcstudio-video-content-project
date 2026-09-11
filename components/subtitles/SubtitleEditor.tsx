"use client";

import { CaptionsIcon } from "lucide-react";
import { SubtitleSegmentList } from "@/components/subtitles/SubtitleSegmentList";
import { CaptionTimingNotice } from "@/components/subtitles/CaptionTimingNotice";
import type { CueTimingSource } from "@/lib/subtitles/cue-timing-source";
import type {
  SaveSubtitleSegmentHandler,
  SubtitleSceneSummaryView,
  SubtitleSegmentView,
} from "@/lib/subtitles/subtitle-view";

/**
 * Lists the caption segments, their words, and how each scene's times were
 * arrived at.
 *
 * The claim this comment used to make — that timing is never hand-edited and is
 * always recomputed from the audio — stopped being true when cue correction
 * arrived. Times are derived by default, moved onto measured pauses where the
 * narration has them, and replaced outright by anything a person sets; the
 * per-scene editor inside each group is where that happens.
 */
export function SubtitleEditor({
  segments,
  scenes,
  projectId,
  timingSource,
  canManage,
  minimumCueDurationMilliseconds,
  onSave,
  onCuesSaved,
}: {
  segments: SubtitleSegmentView[];
  scenes: SubtitleSceneSummaryView[];
  projectId: string;
  timingSource: CueTimingSource;
  canManage: boolean;
  minimumCueDurationMilliseconds: number;
  onSave: SaveSubtitleSegmentHandler;
  onCuesSaved: () => void;
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
        <>
          <CaptionTimingNotice source={timingSource} />
          <SubtitleSegmentList
            canManage={canManage}
            minimumCueDurationMilliseconds={minimumCueDurationMilliseconds}
            onCuesSaved={onCuesSaved}
            onSave={onSave}
            projectId={projectId}
            scenes={scenes}
            segments={segments}
          />
        </>
      )}
    </section>
  );
}
