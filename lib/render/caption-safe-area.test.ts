import { describe, expect, it } from "vitest";
import {
  computeCaptionSafeArea,
  MAX_SAFE_MARGIN_PERCENT,
} from "@/lib/render/caption-safe-area";

describe("computeCaptionSafeArea", () => {
  it("reserves a symmetric margin proportional to each axis", () => {
    const area = computeCaptionSafeArea({
      width: 1920,
      height: 1080,
      safeMarginPercent: 5,
    });
    expect(area.marginXPixels).toBe(96);
    expect(area.marginYPixels).toBe(54);
    expect(area.safeWidthPixels).toBe(1920 - 96 * 2);
    expect(area.safeHeightPixels).toBe(1080 - 54 * 2);
  });

  it("keeps the safe rectangle strictly inside the frame", () => {
    const area = computeCaptionSafeArea({
      width: 1080,
      height: 1920,
      safeMarginPercent: 8,
    });
    expect(area.safeWidthPixels).toBeLessThan(1080);
    expect(area.safeHeightPixels).toBeLessThan(1920);
    expect(area.safeWidthPixels).toBeGreaterThan(0);
    expect(area.safeHeightPixels).toBeGreaterThan(0);
  });

  it("clamps an absurd margin so the safe area never collapses", () => {
    const area = computeCaptionSafeArea({
      width: 1080,
      height: 1080,
      safeMarginPercent: 500,
    });
    const clamped = computeCaptionSafeArea({
      width: 1080,
      height: 1080,
      safeMarginPercent: MAX_SAFE_MARGIN_PERCENT,
    });
    expect(area).toEqual(clamped);
    expect(area.safeWidthPixels).toBeGreaterThan(0);
  });

  it("treats a zero margin as full-frame", () => {
    const area = computeCaptionSafeArea({
      width: 1920,
      height: 1080,
      safeMarginPercent: 0,
    });
    expect(area.marginXPixels).toBe(0);
    expect(area.safeWidthPixels).toBe(1920);
  });

  it("rejects non-positive dimensions", () => {
    expect(() =>
      computeCaptionSafeArea({ width: 0, height: 1080, safeMarginPercent: 5 }),
    ).toThrow(RangeError);
  });
});
