import { describe, expect, it } from "vitest";
import {
  focalPointFromPointerOffset,
  framingObjectPosition,
  framingScale,
} from "@/lib/output-variants/scene-framing";

describe("scene framing", () => {
  it("converts deterministic basis points to a CSS object position", () => {
    expect(
      framingObjectPosition({ focalPointXBps: 2500, focalPointYBps: 7250 }),
    ).toBe("25% 72.5%");
  });

  it("converts scale basis points without rounding drift", () => {
    expect(framingScale(12500)).toBe(1.25);
  });
});

describe("focalPointFromPointerOffset", () => {
  it("converts a mid-container pointer offset to centered basis points", () => {
    expect(
      focalPointFromPointerOffset({ offsetXRatio: 0.5, offsetYRatio: 0.5 }),
    ).toEqual({ focalPointXBps: 5000, focalPointYBps: 5000 });
  });

  it("clamps a pointer offset outside the container to the nearest edge", () => {
    expect(
      focalPointFromPointerOffset({ offsetXRatio: -0.2, offsetYRatio: 1.4 }),
    ).toEqual({ focalPointXBps: 0, focalPointYBps: 10000 });
  });
});
