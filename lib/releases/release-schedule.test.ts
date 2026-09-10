import { describe, expect, it } from "vitest";
import {
  canCancelReleaseSchedule,
  describeScheduledRelease,
  isReleaseScheduleOverdue,
  RELEASE_SCHEDULE_MAX_HORIZON_DAYS,
  RELEASE_SCHEDULE_MIN_LEAD_MINUTES,
  RELEASE_SCHEDULE_STATE_LABELS,
  RELEASE_SCHEDULE_STATES,
  validateReleaseSchedule,
} from "@/lib/releases/release-schedule";

const now = new Date("2026-09-14T06:00:00Z");

describe("validateReleaseSchedule", () => {
  it("accepts a time comfortably ahead and returns the instant it means", () => {
    const result = validateReleaseSchedule({
      localDateTime: "2026-09-15T09:00",
      timeZone: "Africa/Kampala",
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scheduledAt.toISOString()).toBe("2026-09-15T06:00:00.000Z");
  });

  it("refuses a time in the past", () => {
    const result = validateReleaseSchedule({
      localDateTime: "2026-09-13T09:00",
      timeZone: "UTC",
      now,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("publish now instead");
  });

  it("refuses a time too close to be honoured", () => {
    // The sweeper runs on an interval, so a two-minute schedule would promise
    // a precision the system does not have.
    const result = validateReleaseSchedule({
      localDateTime: "2026-09-14T06:02",
      timeZone: "UTC",
      now,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(String(RELEASE_SCHEDULE_MIN_LEAD_MINUTES));
  });

  it("accepts a time exactly at the minimum lead", () => {
    expect(
      validateReleaseSchedule({
        localDateTime: "2026-09-14T06:15",
        timeZone: "UTC",
        now,
      }).ok,
    ).toBe(true);
  });

  it("refuses a time beyond the horizon", () => {
    const result = validateReleaseSchedule({
      localDateTime: "2028-09-14T09:00",
      timeZone: "UTC",
      now,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(String(RELEASE_SCHEDULE_MAX_HORIZON_DAYS));
  });

  it("asks for a date rather than failing silently when none was given", () => {
    const result = validateReleaseSchedule({
      localDateTime: "",
      timeZone: "UTC",
      now,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Choose the date");
  });

  it("refuses an unknown zone rather than guessing one", () => {
    // Guessing would schedule the release for a different instant than asked.
    const result = validateReleaseSchedule({
      localDateTime: "2026-09-15T09:00",
      timeZone: "Nowhere/Nothing",
      now,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("time zone");
  });

  it("refuses a date that does not exist", () => {
    const result = validateReleaseSchedule({
      localDateTime: "2027-02-31T09:00",
      timeZone: "UTC",
      now,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("not a real date");
  });

  it("judges the deadline by the instant, not by the wall clock", () => {
    // 08:00 in Kampala on the 14th is 05:00 UTC, which is already past at
    // 06:00 UTC even though the local reading looks later than "now".
    const result = validateReleaseSchedule({
      localDateTime: "2026-09-14T08:00",
      timeZone: "Africa/Kampala",
      now,
    });
    expect(result.ok).toBe(false);
  });
});

describe("describeScheduledRelease", () => {
  it("always names the zone, because the instant alone is ambiguous", () => {
    const described = describeScheduledRelease({
      scheduledAt: new Date("2026-09-15T06:00:00Z"),
      timeZone: "Africa/Kampala",
    });
    expect(described).toContain("09:00");
    expect(described.trim().split(" ").length).toBeGreaterThan(3);
  });

  it("shows one instant differently in two zones", () => {
    const scheduledAt = new Date("2026-09-15T06:00:00Z");
    expect(describeScheduledRelease({ scheduledAt, timeZone: "UTC" })).not.toBe(
      describeScheduledRelease({ scheduledAt, timeZone: "Asia/Kolkata" }),
    );
  });
});

describe("isReleaseScheduleOverdue", () => {
  it("is false for something still waiting for its time", () => {
    expect(
      isReleaseScheduleOverdue({
        state: "scheduled",
        scheduledAt: new Date("2026-09-15T06:00:00Z"),
        now,
      }),
    ).toBe(false);
  });

  it("is false immediately after the time, inside the sweep window", () => {
    // A schedule is not late just because the sweeper has not run yet.
    expect(
      isReleaseScheduleOverdue({
        state: "scheduled",
        scheduledAt: new Date("2026-09-14T05:55:00Z"),
        now,
      }),
    ).toBe(false);
  });

  it("is true once it is well past its window", () => {
    expect(
      isReleaseScheduleOverdue({
        state: "scheduled",
        scheduledAt: new Date("2026-09-14T04:00:00Z"),
        now,
      }),
    ).toBe(true);
  });

  it("never calls a settled schedule overdue", () => {
    for (const state of [
      "dispatched",
      "cancelled",
      "failed",
      "claimed",
    ] as const)
      expect(
        isReleaseScheduleOverdue({
          state,
          scheduledAt: new Date("2026-09-14T04:00:00Z"),
          now,
        }),
      ).toBe(false);
  });
});

describe("canCancelReleaseSchedule", () => {
  it("allows cancelling only before the upload has been handed over", () => {
    expect(canCancelReleaseSchedule("scheduled")).toBe(true);
    for (const state of [
      "claimed",
      "dispatched",
      "cancelled",
      "failed",
    ] as const)
      expect(canCancelReleaseSchedule(state)).toBe(false);
  });
});

describe("the state register", () => {
  it("labels every state", () => {
    for (const state of RELEASE_SCHEDULE_STATES)
      expect(RELEASE_SCHEDULE_STATE_LABELS[state].length).toBeGreaterThan(0);
  });

  it("never describes a handover as published", () => {
    // Whether the platform published is the publication's business to report.
    for (const label of Object.values(RELEASE_SCHEDULE_STATE_LABELS))
      expect(label.toLowerCase()).not.toContain("published");
  });
});
