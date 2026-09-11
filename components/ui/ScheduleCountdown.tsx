"use client";

import { useSyncExternalStore } from "react";
import { describeCountdown } from "@/lib/format/countdown";
import { cn } from "@/lib/utils";

/**
 * Ticks every thirty seconds, twice the resolution the label can show.
 * Anything faster re-renders for no visible change.
 */
const TICK_MILLISECONDS = 30_000;

/**
 * The current time, shared by every countdown on the page.
 *
 * `useSyncExternalStore` rather than state set from an effect: the clock is
 * external mutable data, which is exactly what this hook exists for, and it
 * gives a server snapshot separate from the client one. That separation is the
 * point — a relative time computed while rendering on the server is already
 * stale by the time it reaches the browser, so the two must be allowed to
 * differ without it counting as a hydration mismatch.
 *
 * The snapshot is bucketed and cached because `useSyncExternalStore` compares
 * snapshots by identity: returning a fresh `Date.now()` on every call would
 * look like a perpetual change and re-render without end.
 */
let cachedBucket = -1;
let cachedNow = 0;

function subscribe(onStoreChange: () => void): () => void {
  const timer = window.setInterval(onStoreChange, TICK_MILLISECONDS);
  return () => window.clearInterval(timer);
}

function getSnapshot(): number {
  const now = Date.now();
  const bucket = Math.floor(now / TICK_MILLISECONDS);
  if (bucket !== cachedBucket) {
    cachedBucket = bucket;
    cachedNow = now;
  }
  return cachedNow;
}

/** Zero means "no clock yet", which renders nothing. */
function getServerSnapshot(): number {
  return 0;
}

/**
 * How long until a scheduled thing is due, beside the absolute time.
 *
 * Renders nothing until the browser has a clock. That is deliberate rather
 * than a loading state: the absolute time sits next to this and is always
 * present, so nothing is missing while this is blank.
 *
 * It never replaces that absolute time. A countdown answers "how long" and a
 * timestamp answers "when", and somebody coordinating a release needs both.
 */
export function ScheduleCountdown({
  className,
  scheduledAt,
  sweepWindowMinutes,
}: {
  className?: string;
  /** ISO instant. */
  scheduledAt: string;
  sweepWindowMinutes: number;
}) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (now === 0) return null;

  const target = new Date(scheduledAt);
  if (Number.isNaN(target.getTime())) return null;

  const phrase = describeCountdown({
    target,
    now: new Date(now),
    sweepWindowMinutes,
  });

  return (
    <span
      // Polite rather than assertive: this changes on a timer, and a screen
      // reader interrupting every thirty seconds would be unusable.
      aria-live="polite"
      className={cn(
        "text-xs",
        phrase.imminent && !phrase.elapsed
          ? "font-medium text-amber-600 dark:text-amber-400"
          : "text-muted-foreground",
        className,
      )}
    >
      {phrase.label}
    </span>
  );
}
