import { describe, expect, it } from "vitest";
import { describeCountdown } from "@/lib/format/countdown";

const NOW = new Date("2026-09-12T09:00:00.000Z");

/** Releases are swept every ten minutes; social posts about once a minute. */
function at(offsetMilliseconds: number, sweepWindowMinutes = 10) {
  return describeCountdown({
    target: new Date(NOW.getTime() + offsetMilliseconds),
    now: NOW,
    sweepWindowMinutes,
  });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("counting down to something far off", () => {
  it("gives plain days past two days out", () => {
    expect(at(3 * DAY + 4 * HOUR).label).toBe("Due in 3 days");
  });

  it("gives hours and minutes within two days", () => {
    expect(at(3 * HOUR + 12 * MINUTE).label).toBe("Due in 3h 12m");
  });

  it("drops a zero minute count rather than writing 3h 0m", () => {
    expect(at(3 * HOUR).label).toBe("Due in 3h");
  });

  it("gives minutes alone under an hour", () => {
    expect(at(42 * MINUTE).label).toBe("Due in 42m");
  });

  it("reports none of these as elapsed or imminent", () => {
    for (const offset of [3 * DAY, 3 * HOUR, 42 * MINUTE]) {
      expect(at(offset).elapsed).toBe(false);
      expect(at(offset).imminent).toBe(false);
    }
  });
});

describe("inside the sweeper's own window", () => {
  it("stops counting and gives a range instead", () => {
    // A release swept every ten minutes cannot honour "Due in 4m".
    const phrase = at(4 * MINUTE);
    expect(phrase.label).toBe("Due in under 10 minutes");
    expect(phrase.imminent).toBe(true);
    expect(phrase.elapsed).toBe(false);
  });

  it("uses each scheduler's own window, not one shared number", () => {
    // Social posts are swept about once a minute, so four minutes out is still
    // an ordinary count for them.
    expect(at(4 * MINUTE, 1).label).toBe("Due in 4m");
  });

  it("reads naturally at a one-minute window", () => {
    expect(at(30_000, 1).label).toBe("Due in under a minute");
  });

  it("never counts down in seconds, at any distance", () => {
    for (const offset of [5_000, 30_000, 90_000, 4 * MINUTE, 3 * HOUR])
      expect(at(offset).label).not.toMatch(/\bs\b|second/i);
  });
});

describe("once the moment has passed", () => {
  it("says due now rather than a negative count", () => {
    const phrase = at(-5 * MINUTE);
    expect(phrase.label).toBe("Due now");
    expect(phrase.elapsed).toBe(true);
  });

  it("treats the exact instant as passed", () => {
    expect(at(0).elapsed).toBe(true);
  });

  it("does not also claim to be imminent, which would be two states at once", () => {
    expect(at(-1).imminent).toBe(false);
  });

  it("says the same thing whether a minute or a week late", () => {
    // How late it is belongs to the overdue warning, which already exists and
    // knows the sweeper's tolerance. Repeating it here would let the two
    // disagree.
    expect(at(-MINUTE).label).toBe(at(-7 * DAY).label);
  });
});

describe("what a label must never do", () => {
  it("never promises a firing time, only when a thing is due", () => {
    for (const offset of [3 * DAY, 3 * HOUR, 4 * MINUTE, -MINUTE])
      expect(at(offset).label).toMatch(/^Due/);
  });

  it("never rounds up into appearing late", () => {
    // 4m30s is "4m", not "5m": a viewer who reads 5m and sees it go at 4m30s
    // is pleased, the reverse reads as a broken schedule.
    expect(at(4 * MINUTE + 30_000, 1).label).toBe("Due in 4m");
  });

  it("never shows zero minutes for something still in the future", () => {
    expect(at(30_000, 0).label).toBe("Due in 1m");
  });
});
