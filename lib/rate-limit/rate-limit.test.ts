import { describe, expect, it } from "vitest";
import {
  buildRateLimitKey,
  isOverRateLimit,
  resolveRateWindowStart,
} from "@/lib/rate-limit/rate-limit";

describe("resolveRateWindowStart", () => {
  it("floors the timestamp to the window boundary", () => {
    const now = new Date("2026-07-19T12:00:37.500Z");
    expect(resolveRateWindowStart(now, 60).toISOString()).toBe(
      "2026-07-19T12:00:00.000Z",
    );
  });

  it("groups two timestamps in the same window to one boundary", () => {
    const a = resolveRateWindowStart(new Date("2026-07-19T12:00:01Z"), 60);
    const b = resolveRateWindowStart(new Date("2026-07-19T12:00:59Z"), 60);
    expect(a.getTime()).toBe(b.getTime());
  });

  it("separates timestamps across a window boundary", () => {
    const a = resolveRateWindowStart(new Date("2026-07-19T12:00:59Z"), 60);
    const b = resolveRateWindowStart(new Date("2026-07-19T12:01:00Z"), 60);
    expect(a.getTime()).not.toBe(b.getTime());
  });

  it("rejects a non-positive window", () => {
    expect(() => resolveRateWindowStart(new Date(), 0)).toThrow(RangeError);
  });
});

describe("isOverRateLimit", () => {
  it("is not over at the limit and over beyond it", () => {
    expect(isOverRateLimit(30, 30)).toBe(false);
    expect(isOverRateLimit(31, 30)).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(() => isOverRateLimit(-1, 30)).toThrow(RangeError);
    expect(() => isOverRateLimit(1, 0)).toThrow(RangeError);
  });
});

describe("buildRateLimitKey", () => {
  it("scopes the key by workspace and operation", () => {
    expect(
      buildRateLimitKey({ workspaceId: "ws1", operation: "video_render" }),
    ).toBe("workspace:ws1:video_render");
  });
});
