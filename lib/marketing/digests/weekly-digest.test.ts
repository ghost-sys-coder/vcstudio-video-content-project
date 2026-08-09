import { describe, expect, it } from "vitest";
import {
  buildWeeklyDigestRecommendations,
  getUtcWeekRange,
} from "@/lib/marketing/digests/weekly-digest";

describe("weekly marketing digest", () => {
  it("uses a stable Monday-to-Monday UTC window", () => {
    expect(getUtcWeekRange(new Date("2026-08-10T18:00:00Z"))).toEqual({
      start: new Date("2026-08-10T00:00:00.000Z"),
      end: new Date("2026-08-17T00:00:00.000Z"),
    });
  });

  it("reports useful actions for a no-activity week", () => {
    const actions = buildWeeklyDigestRecommendations({
      generated: 0,
      reviewed: 0,
      rejected: 0,
      schedulerFailures: 0,
      unhealthyChannels: 0,
      googleBusinessHealthy: true,
      upcomingScheduledContent: 0,
    });
    expect(actions).toContain(
      "Create or enable a bounded content schedule for this week.",
    );
    expect(actions).toContain(
      "Confirm the next approved posts have publishing times.",
    );
  });
});
