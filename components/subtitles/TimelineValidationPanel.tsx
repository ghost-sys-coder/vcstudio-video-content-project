import { CheckCircle2Icon } from "lucide-react";
import { TimelineValidationIssue } from "@/components/subtitles/TimelineValidationIssue";
import { cn } from "@/lib/utils";
import type { TimelineSummaryView } from "@/lib/subtitles/subtitle-view";

function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${(seconds % 60).toFixed(1)}s`;
}

export function TimelineValidationPanel({
  timeline,
}: {
  timeline: TimelineSummaryView;
}) {
  const ready = timeline.status === "ready";

  return (
    <section
      aria-label="Timeline validation"
      className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
              ready
                ? "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive ring-destructive/20",
            )}
          >
            {ready ? (
              <CheckCircle2Icon aria-hidden className="size-3.5" />
            ) : null}
            {ready ? "Timeline ready" : "Timeline blocked"}
          </span>
          {timeline.warningCount > 0 ? (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {timeline.warningCount} warning
              {timeline.warningCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {ready ? (
          <dl className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <dt>Duration</dt>
              <dd className="font-mono tabular-nums text-foreground">
                {formatDuration(timeline.totalDurationMilliseconds)}
              </dd>
            </div>
            <div className="flex items-center gap-1">
              <dt>Frames</dt>
              <dd className="font-mono tabular-nums text-foreground">
                {timeline.totalFrames}
              </dd>
            </div>
            <div className="flex items-center gap-1">
              <dt>Captions</dt>
              <dd className="font-mono tabular-nums text-foreground">
                {timeline.captionCount}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      {ready ? (
        <p className="text-sm text-muted-foreground">
          Every scene has an approved image and narration audio. This{" "}
          {timeline.width}×{timeline.height} timeline at{" "}
          {timeline.framesPerSecond} fps is ready for rendering in a later
          phase.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Resolve the issues below before the video timeline can be built. Each
          scene needs an approved image and approved narration audio with a
          measured duration.
        </p>
      )}

      {timeline.issues.length > 0 ? (
        <ul className="space-y-1.5">
          {timeline.issues.map((issue, index) => (
            <TimelineValidationIssue
              issue={issue}
              key={`${issue.code}-${issue.sceneId ?? "global"}-${index}`}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
