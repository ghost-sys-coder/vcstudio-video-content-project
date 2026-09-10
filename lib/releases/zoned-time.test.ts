import { describe, expect, it } from "vitest";
import {
  describeTimeZone,
  formatInTimeZone,
  getTimeZoneOffsetMinutes,
  isValidTimeZone,
  utcToZonedInputValue,
  zonedDateTimeToUtc,
} from "@/lib/releases/zoned-time";

describe("getTimeZoneOffsetMinutes", () => {
  it("reads a fixed-offset zone", () => {
    // Kampala is UTC+3 all year, which is the project's own case.
    expect(
      getTimeZoneOffsetMinutes(
        new Date("2026-01-15T00:00:00Z"),
        "Africa/Kampala",
      ),
    ).toBe(180);
    expect(
      getTimeZoneOffsetMinutes(
        new Date("2026-07-15T00:00:00Z"),
        "Africa/Kampala",
      ),
    ).toBe(180);
  });

  it("follows a zone across its daylight-saving change", () => {
    expect(
      getTimeZoneOffsetMinutes(
        new Date("2026-01-15T12:00:00Z"),
        "America/New_York",
      ),
    ).toBe(-300);
    expect(
      getTimeZoneOffsetMinutes(
        new Date("2026-07-15T12:00:00Z"),
        "America/New_York",
      ),
    ).toBe(-240);
  });

  it("reads UTC as no offset", () => {
    expect(
      getTimeZoneOffsetMinutes(new Date("2026-03-01T00:00:00Z"), "UTC"),
    ).toBe(0);
  });
});

describe("zonedDateTimeToUtc", () => {
  it("resolves an ordinary local time", () => {
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-09-14T09:00",
        timeZone: "Africa/Kampala",
      })?.toISOString(),
    ).toBe("2026-09-14T06:00:00.000Z");
  });

  it("resolves a local time in a zone behind UTC", () => {
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-09-14T09:00",
        timeZone: "America/New_York",
      })?.toISOString(),
    ).toBe("2026-09-14T13:00:00.000Z");
  });

  it("treats UTC as itself", () => {
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-09-14T09:00",
        timeZone: "UTC",
      })?.toISOString(),
    ).toBe("2026-09-14T09:00:00.000Z");
  });

  it("round-trips any ordinary time through the input format", () => {
    for (const zone of [
      "UTC",
      "Africa/Kampala",
      "America/New_York",
      "Asia/Kolkata",
    ]) {
      const local = "2026-09-14T09:30";
      const instant = zonedDateTimeToUtc({
        localDateTime: local,
        timeZone: zone,
      });
      expect(instant).not.toBeNull();
      if (!instant) continue;
      expect(utcToZonedInputValue(instant, zone)).toBe(local);
    }
  });

  it("handles a half-hour zone", () => {
    // India is UTC+5:30; a whole-hour assumption would be 30 minutes out.
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-09-14T09:00",
        timeZone: "Asia/Kolkata",
      })?.toISOString(),
    ).toBe("2026-09-14T03:30:00.000Z");
  });
});

describe("daylight saving, where a naive conversion goes wrong", () => {
  it("puts a spring local time on the correct side of the change", () => {
    // New York moves to EDT at 02:00 on 8 March 2026. 03:00 that morning is
    // EDT (-4), so it is 07:00 UTC, not 08:00.
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-03-08T03:00",
        timeZone: "America/New_York",
      })?.toISOString(),
    ).toBe("2026-03-08T07:00:00.000Z");
  });

  it("keeps the hour before the change on the old offset", () => {
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-03-08T01:00",
        timeZone: "America/New_York",
      })?.toISOString(),
    ).toBe("2026-03-08T06:00:00.000Z");
  });

  it("still produces an instant for a local time that never happens", () => {
    // 02:30 does not exist on that date: the clock jumps 02:00 to 03:00. A
    // schedule written there must still fire rather than being dropped.
    const instant = zonedDateTimeToUtc({
      localDateTime: "2026-03-08T02:30",
      timeZone: "America/New_York",
    });
    expect(instant).not.toBeNull();
    expect(instant?.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("picks the earlier instant when a local time happens twice", () => {
    // Clocks go back at 02:00 on 1 November 2026, so 01:30 occurs at both
    // 05:30 UTC (EDT) and 06:30 UTC (EST). The earlier one is chosen.
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-11-01T01:30",
        timeZone: "America/New_York",
      })?.toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("is unaffected in a zone that does not observe the change", () => {
    // The project's own zone. Tested anyway, because "our zone has no DST" is
    // exactly the assumption that breaks when a second channel is added.
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-03-08T02:30",
        timeZone: "Africa/Kampala",
      })?.toISOString(),
    ).toBe("2026-03-07T23:30:00.000Z");
  });
});

describe("refusing input that cannot be trusted", () => {
  it("returns null for a malformed local time", () => {
    for (const localDateTime of [
      "",
      "not a date",
      "2026-09-14",
      "14/09/2026 09:00",
      "2026-13-40T99:99",
    ])
      expect(zonedDateTimeToUtc({ localDateTime, timeZone: "UTC" })).toBeNull();
  });

  it("returns null for an unknown zone", () => {
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-09-14T09:00",
        timeZone: "Mars/Olympus_Mons",
      }),
    ).toBeNull();
  });

  it("accepts seconds when a browser supplies them", () => {
    expect(
      zonedDateTimeToUtc({
        localDateTime: "2026-09-14T09:00:30",
        timeZone: "UTC",
      })?.toISOString(),
    ).toBe("2026-09-14T09:00:30.000Z");
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects invented ones", () => {
    expect(isValidTimeZone("Africa/Kampala")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Nowhere/Nothing")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("showing a schedule back to a creator", () => {
  it("formats an instant in the zone it was written in", () => {
    const formatted = formatInTimeZone(
      new Date("2026-09-14T06:00:00Z"),
      "Africa/Kampala",
    );
    expect(formatted).toContain("14");
    expect(formatted).toContain("09:00");
  });

  it("shows the same instant differently in another zone", () => {
    const instant = new Date("2026-09-14T06:00:00Z");
    expect(formatInTimeZone(instant, "Africa/Kampala")).not.toBe(
      formatInTimeZone(instant, "America/New_York"),
    );
  });

  it("names the zone beside the time", () => {
    expect(
      describeTimeZone(new Date("2026-09-14T06:00:00Z"), "Africa/Kampala")
        .length,
    ).toBeGreaterThan(0);
  });

  it("falls back to an ISO instant rather than lying about an unknown zone", () => {
    expect(formatInTimeZone(new Date("2026-09-14T06:00:00Z"), "Bad/Zone")).toBe(
      "2026-09-14T06:00:00.000Z",
    );
  });
});
