import type { ProductionRunEventView } from "@/lib/production-runs/production-run-view";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** What the run did, newest first, in the words it wrote at the time. */
export function ProductionRunEventList({
  events,
}: {
  events: ProductionRunEventView[];
}) {
  if (events.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
    );
  return (
    <ol className="space-y-2 text-sm">
      {events.map((event) => (
        <li className="flex flex-wrap gap-x-3 gap-y-0.5" key={event.id}>
          <time
            className="shrink-0 tabular-nums text-xs text-muted-foreground"
            dateTime={event.at}
          >
            {formatTime(event.at)}
          </time>
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {event.stageLabel}
          </span>
          <span
            className={
              event.kind === "failed" ||
              event.kind === "gate_failed" ||
              event.kind === "budget_refused"
                ? "text-destructive"
                : event.kind === "held"
                  ? "text-amber-700 dark:text-amber-400"
                  : undefined
            }
          >
            {event.message}
          </span>
        </li>
      ))}
    </ol>
  );
}
