/**
 * Converting between a wall-clock time a creator typed and the instant it means.
 *
 * A release is scheduled for "9am on the 14th in Kampala", not for a number of
 * milliseconds. Those are only the same thing once a zone is applied, and the
 * mapping is not one-to-one: a daylight-saving change removes one local hour
 * from the calendar each spring and repeats another each autumn. Storing the
 * UTC instant *and* the zone keeps both facts, so the schedule can be shown
 * back in the zone it was written in without guessing.
 *
 * Implemented on `Intl`, which ships with the platform and carries the current
 * IANA database, rather than on a date library. No dependency is added for
 * this.
 */

/** A local wall-clock time with no zone attached, as `<input type="datetime-local">` gives it. */
const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u;

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * How far ahead of UTC a zone is at one instant, in minutes.
 *
 * Derived by asking `Intl` what the wall clock reads in that zone at that
 * instant and comparing it with the same reading in UTC.
 */
interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** What the clock on the wall reads in one zone at one instant. */
function readWallClock(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return value === undefined ? Number.NaN : Number(value);
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function sameWallClock(a: WallClock, b: WallClock): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

export function getTimeZoneOffsetMinutes(
  instant: Date,
  timeZone: string,
): number {
  const clock = readWallClock(instant, timeZone);
  const asIfUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  );
  return Math.round((asIfUtc - instant.getTime()) / 60_000);
}

/**
 * The instant a local wall-clock time refers to in one zone.
 *
 * Two passes, because the offset itself depends on the instant being solved
 * for: the first guess uses the offset in force at the naive UTC reading, the
 * second corrects it when that guess landed on the other side of a
 * daylight-saving change.
 *
 * At a spring-forward gap the local time never occurs; the result is the
 * instant the clock jumps to, so a schedule written there still fires rather
 * than being silently dropped. At an autumn overlap the local time occurs
 * twice; the earlier instant is chosen. Both are documented choices, not
 * accidents, and both are covered by tests.
 *
 * Returns null for a malformed local time or an unknown zone, so a value from
 * the browser can never become an invalid `Date` in the database.
 */
export function zonedDateTimeToUtc(input: {
  localDateTime: string;
  timeZone: string;
}): Date | null {
  const match = LOCAL_DATE_TIME.exec(input.localDateTime.trim());
  if (!match || !isValidTimeZone(input.timeZone)) return null;

  const [, year, month, day, hour, minute, second] = match;
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const mi = Number(minute);
  const se = second === undefined ? 0 : Number(second);
  // Ranges are checked rather than left to `Date.UTC`, which rolls an
  // impossible value over instead of refusing it: month 13 becomes January of
  // the next year, and 31 February becomes 3 March. Silently scheduling a
  // release for a different day than the one asked for is worse than refusing.
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (h > 23 || mi > 59 || se > 59) return null;

  const naive = Date.UTC(y, mo - 1, d, h, mi, se);
  if (!Number.isFinite(naive)) return null;
  const rolled = new Date(naive);
  if (
    rolled.getUTCFullYear() !== y ||
    rolled.getUTCMonth() !== mo - 1 ||
    rolled.getUTCDate() !== d
  )
    return null;

  const wanted: WallClock = {
    year: y,
    month: mo,
    day: d,
    hour: h,
    minute: mi,
    second: se,
  };

  // Each candidate is verified by reading it back: an offset guess is only
  // right if the instant it produces actually shows the requested time on that
  // zone's clock. Comparing offsets alone silently accepts an instant an hour
  // away from what was asked for.
  const firstOffset = getTimeZoneOffsetMinutes(new Date(naive), input.timeZone);
  const firstCandidate = new Date(naive - firstOffset * 60_000);
  if (sameWallClock(readWallClock(firstCandidate, input.timeZone), wanted))
    return firstCandidate;

  const secondOffset = getTimeZoneOffsetMinutes(firstCandidate, input.timeZone);
  const secondCandidate = new Date(naive - secondOffset * 60_000);
  if (sameWallClock(readWallClock(secondCandidate, input.timeZone), wanted))
    return secondCandidate;

  // Neither reads back, so this local time does not exist: it falls in the hour
  // a spring-forward change removes. The later candidate is the instant the
  // clock jumps to, so the release fires just after the gap rather than an hour
  // before the time that was asked for.
  return firstCandidate.getTime() > secondCandidate.getTime()
    ? firstCandidate
    : secondCandidate;
}

/** The wall-clock reading of an instant in one zone, for display. */
export function formatInTimeZone(
  instant: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!isValidTimeZone(timeZone)) return instant.toISOString();
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...options,
  }).format(instant);
}

/** A short zone label such as "EAT" or "GMT+3", for showing beside a time. */
export function describeTimeZone(instant: Date, timeZone: string): string {
  if (!isValidTimeZone(timeZone)) return "UTC";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(instant);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

/** The viewer's own zone, for defaulting the picker. Falls back to UTC. */
export function resolveBrowserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : "UTC";
  } catch {
    return "UTC";
  }
}

/** An instant rendered back into the `datetime-local` shape for one zone. */
export function utcToZonedInputValue(instant: Date, timeZone: string): string {
  const offset = getTimeZoneOffsetMinutes(instant, timeZone);
  const shifted = new Date(instant.getTime() + offset * 60_000);
  return shifted.toISOString().slice(0, 16);
}
