"use client";

import { useTransition } from "react";
import { AlertTriangleIcon, CalendarClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleCountdown } from "@/components/ui/ScheduleCountdown";
import { RELEASE_SCHEDULE_SWEEP_MINUTES } from "@/lib/releases/release-schedule";
import type { ReleaseScheduleEntryView } from "@/lib/releases/release-schedule-view";
import { cn } from "@/lib/utils";

/**
 * One scheduled release.
 *
 * The time is always shown in the zone it was written in, with that zone named,
 * because the same instant is a different day elsewhere. A schedule that is
 * past its time and still waiting says so rather than quietly reading as
 * pending, and a failure shows its reason instead of a bare status.
 */
export function ReleaseScheduleRow({
  entry,
  canManage,
  onCancel,
}: {
  entry: ReleaseScheduleEntryView;
  canManage: boolean;
  onCancel: (scheduleId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarClockIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="text-sm font-medium">{entry.scheduledLabel}</span>
          <span className="text-xs text-muted-foreground">
            {entry.platformLabel}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              entry.state === "failed"
                ? "bg-destructive/10 text-destructive ring-destructive/20"
                : entry.state === "dispatched"
                  ? "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                  : entry.state === "cancelled"
                    ? "bg-muted text-muted-foreground ring-foreground/15"
                    : "bg-primary/10 text-primary ring-primary/20",
            )}
          >
            {entry.stateLabel}
          </span>
          {/* Only while it is still waiting. A countdown beside a dispatched
              or cancelled release would be counting to nothing. */}
          {entry.state === "scheduled" ? (
            <ScheduleCountdown
              scheduledAt={entry.scheduledAtIso}
              sweepWindowMinutes={RELEASE_SCHEDULE_SWEEP_MINUTES}
            />
          ) : null}
        </div>

        {entry.overdue ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangleIcon aria-hidden className="size-3.5" />
            Past its time and still waiting. The scheduler runs every 10
            minutes.
          </p>
        ) : null}

        {entry.safeErrorMessage ? (
          <p className="text-xs text-destructive">{entry.safeErrorMessage}</p>
        ) : null}
      </div>

      {entry.canCancel && canManage ? (
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await onCancel(entry.id);
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {pending ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </li>
  );
}
