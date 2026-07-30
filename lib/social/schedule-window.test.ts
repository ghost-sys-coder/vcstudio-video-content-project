import { describe, expect, it } from "vitest";
import {
  checkScheduleInstant,
  isDue,
  MAXIMUM_SCHEDULE_HORIZON_DAYS,
  MINIMUM_SCHEDULE_LEAD_SECONDS,
  toDateTimeLocalValue,
} from "@/lib/social/schedule-window";

const now = new Date("2026-07-30T12:00:00.000Z");

function at(offsetSeconds: number): Date {
  return new Date(now.getTime() + offsetSeconds * 1000);
}

describe("checkScheduleInstant", () => {
  it("accepts an instant comfortably ahead", () => {
    const result = checkScheduleInstant({ scheduledAt: at(3600), now });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.scheduledAt).toEqual(at(3600));
  });

  it("rejects a time in the past", () => {
    const result = checkScheduleInstant({ scheduledAt: at(-1), now });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("already passed");
  });

  it("rejects an instant inside the sweeper's own interval", () => {
    // Anything closer than the lead time would fire on the very next sweep,
    // which makes "scheduled" indistinguishable from "publish now".
    const result = checkScheduleInstant({
      scheduledAt: at(MINIMUM_SCHEDULE_LEAD_SECONDS - 1),
      now,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("publish now");
  });

  it("accepts exactly the minimum lead", () => {
    expect(
      checkScheduleInstant({
        scheduledAt: at(MINIMUM_SCHEDULE_LEAD_SECONDS),
        now,
      }).valid,
    ).toBe(true);
  });

  it("rejects an instant beyond the horizon", () => {
    const result = checkScheduleInstant({
      scheduledAt: at(MAXIMUM_SCHEDULE_HORIZON_DAYS * 24 * 3600 + 60),
      now,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("365 days");
  });

  it("rejects an unparseable date rather than storing NaN", () => {
    expect(
      checkScheduleInstant({ scheduledAt: new Date("nonsense"), now }).valid,
    ).toBe(false);
  });
});

describe("isDue", () => {
  it("is due at or before now, and not after", () => {
    expect(isDue({ scheduledAt: at(-1), now })).toBe(true);
    expect(isDue({ scheduledAt: new Date(now), now })).toBe(true);
    expect(isDue({ scheduledAt: at(1), now })).toBe(false);
  });

  it("treats an unscheduled post as never due", () => {
    expect(isDue({ scheduledAt: null, now })).toBe(false);
  });
});

describe("toDateTimeLocalValue", () => {
  it("renders local time, not UTC, in the format the input expects", () => {
    const value = new Date(2026, 6, 30, 9, 5);
    expect(toDateTimeLocalValue(value)).toBe("2026-07-30T09:05");
  });

  it("zero-pads every component", () => {
    expect(toDateTimeLocalValue(new Date(2026, 0, 3, 4, 7))).toBe(
      "2026-01-03T04:07",
    );
  });
});
