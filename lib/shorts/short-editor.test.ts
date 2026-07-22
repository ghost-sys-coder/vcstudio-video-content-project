import { describe, expect, it } from "vitest";
import { snapToNearestBoundary } from "@/lib/shorts/short-editor";

describe("snapToNearestBoundary", () => {
  it("snaps a precise cut to the closest subtitle or scene boundary", () => {
    expect(snapToNearestBoundary(4350, [0, 4000, 9000])).toBe(4000);
  });

  it("preserves the exact cut when snapping has no available boundary", () => {
    expect(snapToNearestBoundary(4350, [])).toBe(4350);
  });
});
