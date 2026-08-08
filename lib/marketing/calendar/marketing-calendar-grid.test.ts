import { describe, expect, it } from "vitest";
import {
  buildMarketingCalendarMonth,
  type MarketingCalendarEntry,
} from "@/lib/marketing/calendar/marketing-calendar-grid";

const entry: MarketingCalendarEntry = {
  kind: "social_post",
  id: "post-1",
  title: "Launch",
  status: "scheduled",
  occursAt: "2026-08-12T10:00:00.000Z",
  mediaPreviewUrl: null,
  mediaKind: null,
  platforms: [],
};

describe("buildMarketingCalendarMonth", () => {
  it("builds a stable six-week Sunday-first grid", () => {
    const days = buildMarketingCalendarMonth({
      year: 2026,
      month: 7,
      entries: [],
      today: new Date("2026-08-08T12:00:00"),
    });
    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ key: "2026-07-26", dayNumber: 26 });
    expect(days[41]).toMatchObject({ key: "2026-09-05", dayNumber: 5 });
    expect(days.find((day) => day.key === "2026-08-08")?.isToday).toBe(true);
  });

  it("places entries on their local calendar day", () => {
    const days = buildMarketingCalendarMonth({
      year: 2026,
      month: 7,
      entries: [entry],
    });
    expect(days.find((day) => day.key === "2026-08-12")?.entries).toEqual([
      entry,
    ]);
  });
});
