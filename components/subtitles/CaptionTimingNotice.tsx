import { ClockIcon } from "lucide-react";
import {
  describeCueTimingSource,
  type CueTimingSource,
} from "@/lib/subtitles/cue-timing-source";

/**
 * States plainly how these caption times were arrived at.
 *
 * It is the most important thing on the page and it sits above the track for
 * that reason. A creator who believes captions are matched to speech will not
 * check them; one who is told the timing was estimated from character counts
 * will. The wording comes from `cue-timing-source.ts`, which is where the
 * vocabulary is constrained.
 */
export function CaptionTimingNotice({ source }: { source: CueTimingSource }) {
  const described = describeCueTimingSource(source);
  return (
    <div className="flex items-start gap-2 rounded-xl border p-3">
      <ClockIcon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{described.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {described.detail}
        </p>
      </div>
    </div>
  );
}
