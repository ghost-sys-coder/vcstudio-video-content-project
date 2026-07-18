import { formatDurationMs } from "@/lib/format/duration";
import type { RenderTimelineSummaryView } from "@/lib/render/render-view";

export function TimelineSummary({
  timeline,
}: {
  timeline: RenderTimelineSummaryView;
}) {
  const ready = timeline.status === "ready";

  return (
    <section
      aria-label="Timeline summary"
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <span
          className={
            ready
              ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
              : "text-xs font-medium text-destructive"
          }
        >
          {ready
            ? "Ready to render"
            : `${timeline.errorCount} blocking issue${timeline.errorCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground sm:grid-cols-4">
        <div>
          <dt className="opacity-70">Resolution</dt>
          <dd className="font-medium text-foreground">
            {timeline.width}×{timeline.height}
          </dd>
        </div>
        <div>
          <dt className="opacity-70">Frame rate</dt>
          <dd className="font-medium text-foreground">
            {timeline.framesPerSecond} fps
          </dd>
        </div>
        <div>
          <dt className="opacity-70">Duration</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {ready ? formatDurationMs(timeline.totalDurationMilliseconds) : "—"}
          </dd>
        </div>
        <div>
          <dt className="opacity-70">Scenes / captions</dt>
          <dd className="font-medium text-foreground">
            {timeline.sceneCount} / {timeline.captionCount}
          </dd>
        </div>
      </dl>
    </section>
  );
}
