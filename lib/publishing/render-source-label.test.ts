import { describe, expect, it } from "vitest";
import {
  buildRenderOptionLabel,
  classifyRenderSource,
  formatRenderClock,
  RENDER_KIND_ORDER,
} from "@/lib/publishing/render-source-label";

describe("classifyRenderSource", () => {
  it("names a short from its composition name", () => {
    expect(
      classifyRenderSource({ shortName: "short-testing", variantName: null }),
    ).toEqual({
      kind: "short",
      groupLabel: "Shorts",
      sourceName: "short-testing",
    });
  });

  it("names a repurposed variant", () => {
    expect(
      classifyRenderSource({ shortName: null, variantName: "TikTok 9:16" }),
    ).toEqual({
      kind: "variant",
      groupLabel: "Repurposed variants",
      sourceName: "TikTok 9:16",
    });
  });

  it("treats a render with neither source as full-length", () => {
    expect(
      classifyRenderSource({ shortName: null, variantName: null }),
    ).toEqual({ kind: "longform", groupLabel: "Full video", sourceName: null });
  });

  it("prefers the short association when somehow both are present", () => {
    // A short renders through a variant, so both columns can be set; it is still
    // a short to the user.
    expect(
      classifyRenderSource({ shortName: "Hook", variantName: "9:16" }).kind,
    ).toBe("short");
  });

  it("ignores blank names", () => {
    expect(
      classifyRenderSource({ shortName: "   ", variantName: "" }).kind,
    ).toBe("longform");
  });
});

describe("RENDER_KIND_ORDER", () => {
  it("orders shorts before variants before full-length", () => {
    expect(RENDER_KIND_ORDER.short).toBeLessThan(RENDER_KIND_ORDER.variant);
    expect(RENDER_KIND_ORDER.variant).toBeLessThan(RENDER_KIND_ORDER.longform);
  });
});

describe("formatRenderClock", () => {
  it("formats sub-minute durations as m:ss", () => {
    expect(formatRenderClock(2000)).toBe("0:02");
    expect(formatRenderClock(59_000)).toBe("0:59");
  });

  it("formats minutes", () => {
    expect(formatRenderClock(660_000)).toBe("11:00");
    expect(formatRenderClock(75_000)).toBe("1:15");
  });

  it("adds an hours field past 3600s", () => {
    expect(formatRenderClock(3_661_000)).toBe("1:01:01");
  });

  it("clamps negatives to zero", () => {
    expect(formatRenderClock(-5000)).toBe("0:00");
  });
});

describe("buildRenderOptionLabel", () => {
  it("labels a named short with kind, name, dimensions, and clock", () => {
    expect(
      buildRenderOptionLabel({
        kind: "short",
        sourceName: "short-testing",
        width: 1080,
        height: 1920,
        durationMilliseconds: 2000,
      }),
    ).toBe("Short · short-testing — 1080×1920 · 0:02");
  });

  it("labels a full-length render without a source name", () => {
    expect(
      buildRenderOptionLabel({
        kind: "longform",
        sourceName: null,
        width: 1920,
        height: 1080,
        durationMilliseconds: 660_000,
      }),
    ).toBe("Full video — 1920×1080 · 11:00");
  });

  it("distinguishes two same-dimension long-form renders only by clock", () => {
    const a = buildRenderOptionLabel({
      kind: "longform",
      sourceName: null,
      width: 1920,
      height: 1080,
      durationMilliseconds: 458_000,
    });
    const b = buildRenderOptionLabel({
      kind: "longform",
      sourceName: null,
      width: 1920,
      height: 1080,
      durationMilliseconds: 691_000,
    });
    expect(a).not.toBe(b);
  });
});
