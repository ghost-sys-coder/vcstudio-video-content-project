import {
  describeTimeZone,
  formatInTimeZone,
  isValidTimeZone,
  zonedDateTimeToUtc,
} from "@/lib/releases/zoned-time";

/**
 * The states a scheduled release moves through.
 *
 * They are deliberately separate from the publication's own status. "Scheduled"
 * is an intention this app holds; "dispatched" means the upload was handed to
 * the publication worker; whether the platform then accepted, processed or
 * published it is the publication's business to report. Collapsing the two
 * would let a schedule read as published when nothing had left the building.
 */
export const RELEASE_SCHEDULE_STATES = [
  "scheduled",
  "claimed",
  "dispatched",
  "cancelled",
  "failed",
] as const;

export type ReleaseScheduleState = (typeof RELEASE_SCHEDULE_STATES)[number];

export const RELEASE_SCHEDULE_STATE_LABELS: Record<
  ReleaseScheduleState,
  string
> = {
  scheduled: "Scheduled",
  claimed: "Starting",
  dispatched: "Handed to upload",
  cancelled: "Cancelled",
  failed: "Failed to start",
};

/**
 * How far ahead a release must be set.
 *
 * The sweeper runs every ten minutes, so anything closer than that would be
 * indistinguishable from publishing now, and promising a precision the system
 * does not have is worse than refusing it.
 */
export const RELEASE_SCHEDULE_MIN_LEAD_MINUTES = 15;

/** How far ahead a release may be set. A year is already beyond any real plan. */
export const RELEASE_SCHEDULE_MAX_HORIZON_DAYS = 365;

/**
 * The delivery window the sweeper can actually honour.
 *
 * Stated plainly in the interface rather than implied, because a creator who
 * believes a release goes out at exactly 09:00 will read a 09:07 timestamp as
 * a bug.
 */
export const RELEASE_SCHEDULE_SWEEP_MINUTES = 10;

export type ReleaseScheduleValidation =
  { ok: true; scheduledAt: Date } | { ok: false; message: string };

export function validateReleaseSchedule(input: {
  localDateTime: string;
  timeZone: string;
  now?: Date;
}): ReleaseScheduleValidation {
  if (!input.localDateTime.trim())
    return { ok: false, message: "Choose the date and time to publish." };
  if (!isValidTimeZone(input.timeZone))
    return { ok: false, message: "Choose a time zone." };

  const scheduledAt = zonedDateTimeToUtc({
    localDateTime: input.localDateTime,
    timeZone: input.timeZone,
  });
  if (!scheduledAt)
    return { ok: false, message: "That is not a real date and time." };

  const now = input.now ?? new Date();
  const minutesAhead = (scheduledAt.getTime() - now.getTime()) / 60_000;
  if (minutesAhead < RELEASE_SCHEDULE_MIN_LEAD_MINUTES)
    return {
      ok: false,
      message: `Schedule at least ${RELEASE_SCHEDULE_MIN_LEAD_MINUTES} minutes ahead, or publish now instead.`,
    };
  if (minutesAhead > RELEASE_SCHEDULE_MAX_HORIZON_DAYS * 24 * 60)
    return {
      ok: false,
      message: `Schedule within ${RELEASE_SCHEDULE_MAX_HORIZON_DAYS} days.`,
    };

  return { ok: true, scheduledAt };
}

/**
 * How a schedule reads to a creator.
 *
 * The zone is always shown. The same instant is a different day in a different
 * zone, and a bare time with no zone is the ambiguity this whole module exists
 * to remove.
 */
export function describeScheduledRelease(input: {
  scheduledAt: Date;
  timeZone: string;
}): string {
  return `${formatInTimeZone(input.scheduledAt, input.timeZone)} ${describeTimeZone(
    input.scheduledAt,
    input.timeZone,
  )}`;
}

/**
 * Whether a schedule that is still waiting has passed its time.
 *
 * The sweeper claims in time order, so a backlog shows here as overdue rather
 * than being hidden. Saying "overdue" is honest; silently showing it as still
 * scheduled is not.
 */
export function isReleaseScheduleOverdue(input: {
  state: ReleaseScheduleState;
  scheduledAt: Date;
  now?: Date;
}): boolean {
  if (input.state !== "scheduled") return false;
  const now = input.now ?? new Date();
  return (
    input.scheduledAt.getTime() + RELEASE_SCHEDULE_SWEEP_MINUTES * 2 * 60_000 <
    now.getTime()
  );
}

/** Whether a schedule can still be called off. */
export function canCancelReleaseSchedule(state: ReleaseScheduleState): boolean {
  // Only before it has been claimed. Once the row is claimed the upload is
  // already being handed over, and cancelling there would leave the schedule
  // and the publication disagreeing about what happened.
  return state === "scheduled";
}
