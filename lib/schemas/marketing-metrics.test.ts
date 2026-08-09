import { describe, expect, it } from "vitest";
import { parseMarketingMetricsRange } from "@/lib/schemas/marketing-metrics";

describe("marketing metrics range", () => {
  it("builds an equal immediately preceding comparison window", () => {
    const range = parseMarketingMetricsRange(
      "90",
      new Date("2026-08-10T00:00:00Z"),
    );
    expect(range.days).toBe(90);
    expect(range.to.getTime() - range.from.getTime()).toBe(
      range.previousTo.getTime() - range.previousFrom.getTime(),
    );
    expect(range.previousTo).toEqual(range.from);
  });
});
