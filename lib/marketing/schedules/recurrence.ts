import type { MarketingScheduleFrequency } from "@/db/schema";

const DAY_MILLISECONDS = 86_400_000;

type Recurrence = {
  frequency: MarketingScheduleFrequency;
  byWeekday: number[];
  byMonthDay: number | null;
  timeOfDayMinutes: number;
  timezone: string;
};

function zonedParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function localDateToInstant(input: {
  year: number;
  month: number;
  day: number;
  minutes: number;
  timezone: string;
}) {
  const hour = Math.floor(input.minutes / 60);
  const minute = input.minutes % 60;
  const wantedUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    hour,
    minute,
  );
  let candidate = new Date(wantedUtc);

  // The offset is obtained through Intl rather than a timezone dependency.
  // Repeating handles the one-hour offset change around DST boundaries.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(candidate, input.timezone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = wantedUtc - represented;
    if (adjustment === 0) return candidate;
    candidate = new Date(candidate.getTime() + adjustment);
  }
  return candidate;
}

export function getStartOfZonedDay(value: Date, timezone: string) {
  const parts = zonedParts(value, timezone);
  return localDateToInstant({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    minutes: 0,
    timezone,
  });
}

export function getStartOfZonedMonth(value: Date, timezone: string) {
  const parts = zonedParts(value, timezone);
  return localDateToInstant({
    year: parts.year,
    month: parts.month,
    day: 1,
    minutes: 0,
    timezone,
  });
}

function matchesRecurrence(
  date: { year: number; month: number; day: number },
  recurrence: Recurrence,
) {
  const weekday = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();
  if (recurrence.frequency === "daily") return true;
  if (recurrence.frequency === "weekly")
    return recurrence.byWeekday.includes(weekday);
  return recurrence.byMonthDay === date.day;
}

export function getNextScheduleOccurrence(input: {
  recurrence: Recurrence;
  after: Date;
}): Date {
  // Validate the IANA zone before entering the bounded search.
  zonedParts(input.after, input.recurrence.timezone);
  const local = zonedParts(input.after, input.recurrence.timezone);
  const localMidnight = Date.UTC(local.year, local.month - 1, local.day);

  for (let dayOffset = 0; dayOffset <= 370; dayOffset += 1) {
    const day = new Date(localMidnight + dayOffset * DAY_MILLISECONDS);
    const parts = {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
    };
    if (!matchesRecurrence(parts, input.recurrence)) continue;
    const occurrence = localDateToInstant({
      ...parts,
      minutes: input.recurrence.timeOfDayMinutes,
      timezone: input.recurrence.timezone,
    });
    if (occurrence.getTime() > input.after.getTime()) return occurrence;
  }

  throw new Error("SCHEDULE_OCCURRENCE_UNAVAILABLE");
}
