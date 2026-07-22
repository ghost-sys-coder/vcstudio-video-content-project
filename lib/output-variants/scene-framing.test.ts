import { describe, expect, it } from "vitest";
import {
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
