/**
 * Rules for when a post may be scheduled.
 *
 * Pure and clock-injectable so both the composer and the server apply exactly
 * the same rules, and so the edge cases can be tested without waiting for real
 * time to pass.
 *
 * A scheduled instant is stored as an absolute `timestamptz`. The author's
 * timezone is kept alongside it purely so the UI can redisplay their intent —
 * scheduling logic never reasons in local time, because "9am" means a different
 * instant depending on who is looking.
 */

/**
 * The sweeper runs about once a minute, so anything closer than this would fire
 * immediately and make "scheduled" a lie. A user who wants it now has Publish.
 */
export const MINIMUM_SCHEDULE_LEAD_SECONDS = 120;

/** A year out. Past this it is almost always a typo in the year field. */
export const MAXIMUM_SCHEDULE_HORIZON_DAYS = 365;

export type ScheduleCheck =
  { valid: true; scheduledAt: Date } | { valid: false; reason: string };

export function checkScheduleInstant(input: {
  scheduledAt: Date;
  now?: Date;
}): ScheduleCheck {
  const now = input.now ?? new Date();
  const at = input.scheduledAt;

  if (Number.isNaN(at.getTime()))
    return { valid: false, reason: "That is not a valid date and time." };

  const leadMilliseconds = at.getTime() - now.getTime();
  if (leadMilliseconds < 0)
    return { valid: false, reason: "That time has already passed." };
  if (leadMilliseconds < MINIMUM_SCHEDULE_LEAD_SECONDS * 1000)
    return {
      valid: false,
      reason: `Schedule at least ${MINIMUM_SCHEDULE_LEAD_SECONDS / 60} minutes ahead, or publish now instead.`,
    };
  if (leadMilliseconds > MAXIMUM_SCHEDULE_HORIZON_DAYS * 24 * 60 * 60 * 1000)
    return {
      valid: false,
      reason: `Schedule within ${MAXIMUM_SCHEDULE_HORIZON_DAYS} days.`,
    };

  return { valid: true, scheduledAt: at };
}

/** Whether a scheduled post is due for the sweeper to claim. */
export function isDue(input: {
  scheduledAt: Date | null;
  now?: Date;
}): boolean {
  if (!input.scheduledAt) return false;
  return input.scheduledAt.getTime() <= (input.now ?? new Date()).getTime();
}

/**
 * The value an `<input type="datetime-local">` expects, in the viewer's own
 * local time. Deliberately not `toISOString`, which would render UTC into a
 * control the browser interprets as local and shift the time by the offset.
 */
export function toDateTimeLocalValue(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    value.getFullYear(),
    "-",
    pad(value.getMonth() + 1),
    "-",
    pad(value.getDate()),
    "T",
    pad(value.getHours()),
    ":",
    pad(value.getMinutes()),
  ].join("");
}
