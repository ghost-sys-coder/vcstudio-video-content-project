import { describe, expect, it } from "vitest";
import {
  renderDurationSeconds,
  validateRenderDuration,
} from "@/lib/render/render-duration";

describe("renderDurationSeconds", () => {
  it("converts milliseconds to seconds", () => {
    expect(renderDurationSeconds(5250)).toBe(5.25);
    expect(renderDurationSeconds(0)).toBe(0);
  });

  it("rejects negative or fractional milliseconds", () => {
    expect(() => renderDurationSeconds(-1)).toThrow(RangeError);
    expect(() => renderDurationSeconds(1.5)).toThrow(RangeError);
  });
});

describe("validateRenderDuration", () => {
  it("accepts a duration within the limit", () => {
    expect(
      validateRenderDuration({
        durationMilliseconds: 60_000,
        maxRenderDurationSeconds: 900,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a zero-length timeline", () => {
    const result = validateRenderDuration({
      durationMilliseconds: 0,
      maxRenderDurationSeconds: 900,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a duration beyond the configured cap", () => {
    const result = validateRenderDuration({
      durationMilliseconds: 901_000,
      maxRenderDurationSeconds: 900,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("900s");
  });

  it("accepts a duration exactly at the cap", () => {
    expect(
      validateRenderDuration({
        durationMilliseconds: 900_000,
        maxRenderDurationSeconds: 900,
      }),
    ).toEqual({ ok: true });
  });
});
