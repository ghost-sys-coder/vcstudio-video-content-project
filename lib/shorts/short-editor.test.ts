import { describe, expect, it } from "vitest";
import {
  snapToNearestBoundary,
  sumDurationMilliseconds,
} from "@/lib/shorts/short-editor";

describe("snapToNearestBoundary", () => {
  it("snaps a precise cut to the closest subtitle or scene boundary", () => {
    expect(snapToNearestBoundary(4350, [0, 4000, 9000])).toBe(4000);
  });

  it("preserves the exact cut when snapping has no available boundary", () => {
    expect(snapToNearestBoundary(4350, [])).toBe(4350);
  });
});

describe("sumDurationMilliseconds", () => {
  it("sums end minus start across every range", () => {
    expect(
      sumDurationMilliseconds([
        { startMilliseconds: 0, endMilliseconds: 2000 },
        { startMilliseconds: 5000, endMilliseconds: 9500 },
      ]),
    ).toBe(6500);
  });

  it("returns zero for an empty list", () => {
    expect(sumDurationMilliseconds([])).toBe(0);
  });
});
