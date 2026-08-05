import { describe, expect, it } from "vitest";
import {
  getNextScheduleOccurrence,
  getStartOfZonedDay,
  getStartOfZonedMonth,
} from "@/lib/marketing/schedules/recurrence";

describe("getNextScheduleOccurrence", () => {
  it("finds the next daily occurrence in the configured timezone", () => {
    expect(
      getNextScheduleOccurrence({
        after: new Date("2026-08-05T08:00:00.000Z"),
        recurrence: {
          frequency: "daily",
          byWeekday: [],
          byMonthDay: null,
          timeOfDayMinutes: 12 * 60,
          timezone: "Africa/Kampala",
        },
      }).toISOString(),
    ).toBe("2026-08-05T09:00:00.000Z");
  });

  it("selects only configured weekdays", () => {
    expect(
      getNextScheduleOccurrence({
        after: new Date("2026-08-07T18:00:00.000Z"),
        recurrence: {
          frequency: "weekly",
          byWeekday: [1],
          byMonthDay: null,
          timeOfDayMinutes: 9 * 60,
          timezone: "UTC",
        },
      }).toISOString(),
    ).toBe("2026-08-10T09:00:00.000Z");
  });

  it("keeps monthly schedules on days that occur every month", () => {
    expect(
      getNextScheduleOccurrence({
        after: new Date("2026-02-28T12:00:00.000Z"),
        recurrence: {
          frequency: "monthly",
          byWeekday: [],
          byMonthDay: 28,
          timeOfDayMinutes: 9 * 60,
          timezone: "UTC",
        },
      }).toISOString(),
    ).toBe("2026-03-28T09:00:00.000Z");
  });

  it("preserves local wall time across daylight-saving changes", () => {
    expect(
      getNextScheduleOccurrence({
        after: new Date("2026-03-07T15:00:00.000Z"),
        recurrence: {
          frequency: "daily",
          byWeekday: [],
          byMonthDay: null,
          timeOfDayMinutes: 9 * 60,
          timezone: "America/New_York",
        },
      }).toISOString(),
    ).toBe("2026-03-08T13:00:00.000Z");
  });
});

describe("zoned cap windows", () => {
  it("starts the daily cap at midnight in the workspace timezone", () => {
    expect(
      getStartOfZonedDay(
        new Date("2026-08-05T12:00:00.000Z"),
        "Africa/Kampala",
      ).toISOString(),
    ).toBe("2026-08-04T21:00:00.000Z");
  });

  it("starts the monthly rule cap in the rule timezone", () => {
    expect(
      getStartOfZonedMonth(
        new Date("2026-08-15T12:00:00.000Z"),
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-08-01T04:00:00.000Z");
  });
});
