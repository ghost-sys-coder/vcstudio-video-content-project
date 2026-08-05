import { describe, expect, it } from "vitest";
import { formatShortDate, parseDateValue } from "@/lib/format/date";

describe("parseDateValue", () => {
  it("preserves valid Date instances", () => {
    const value = new Date("2026-08-05T12:00:00.000Z");

    expect(parseDateValue(value)).toBe(value);
  });

  it("normalizes serialized database timestamps", () => {
    expect(parseDateValue("2026-08-05T12:00:00.000Z")?.toISOString()).toBe(
      "2026-08-05T12:00:00.000Z",
    );
  });

  it("rejects missing and invalid timestamps", () => {
    expect(parseDateValue(undefined)).toBeNull();
    expect(parseDateValue("not-a-date")).toBeNull();
  });
});

describe("formatShortDate", () => {
  it("formats both Date instances and serialized timestamps", () => {
    expect(formatShortDate(new Date(2026, 7, 5))).toBe("Aug 5, 2026");
    expect(formatShortDate("2026-08-05T12:00:00.000Z")).toBe("Aug 5, 2026");
  });
});
