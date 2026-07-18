import { AudioDurationDisplay } from "@/components/audio/AudioDurationDisplay";
import type {
  AudioProgressCounts,
  AudioTimelineView,
} from "@/lib/audio/audio-view";

export function AudioGenerationProgress({
  progress,
  timeline,
}: {
  progress: AudioProgressCounts;
  timeline: AudioTimelineView;
}) {
  const active = progress.pending + progress.queued + progress.running;
  const terminal = progress.succeeded + progress.failed + progress.cancelled;
  const percent =
    progress.total > 0 ? Math.round((terminal / progress.total) * 100) : 0;

  return (
    <section
      aria-label="Audio generation progress"
      className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Project timeline</span>
          <span className="text-muted-foreground">
            {timeline.scenesWithApprovedAudio} of {timeline.totalScenes} scenes
            voiced
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Total</span>
          <AudioDurationDisplay
            durationMilliseconds={timeline.totalDurationMilliseconds}
            frames={timeline.totalFrames}
          />
          <span className="opacity-70">at {timeline.framesPerSecond} fps</span>
        </div>
      </div>

      {active > 0 ? (
        <>
          <div
            aria-hidden
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
            {(
              [
                ["Total", progress.total],
                ["Queued", progress.queued + progress.pending],
                ["Running", progress.running],
                ["Succeeded", progress.succeeded],
                ["Failed", progress.failed],
                ["Cancelled", progress.cancelled],
              ] as const
            ).map(([label, value]) => (
              <div
                className="rounded-lg bg-muted/40 py-2 ring-1 ring-inset ring-foreground/10"
                key={label}
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </section>
  );
}
