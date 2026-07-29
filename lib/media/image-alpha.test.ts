import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import { analyzeImageAlpha, ImageAnalysisError } from "@/lib/media/image-alpha";

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const OPAQUE_RED = { r: 220, g: 40, b: 40, alpha: 1 };

function canvas(
  size: number,
  background: { r: number; g: number; b: number; alpha: number },
) {
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  });
}

describe("analyzeImageAlpha", () => {
  it("reports no alpha channel for a format that cannot carry one", async () => {
    const bytes = await canvas(100, OPAQUE_RED).jpeg().toBuffer();
    const analysis = await analyzeImageAlpha(bytes);
    expect(analysis.hasAlphaChannel).toBe(false);
    expect(analysis.transparentShareBps).toBe(0);
    expect(analysis.cornersTransparent).toBe(false);
    expect(analysis.width).toBe(100);
    expect(analysis.height).toBe(100);
  });

  it("catches the real failure: an alpha channel that is fully painted in", async () => {
    const bytes = await canvas(100, OPAQUE_RED).png().toBuffer();
    const analysis = await analyzeImageAlpha(bytes);
    expect(analysis.hasAlphaChannel).toBe(true);
    expect(analysis.transparentShareBps).toBe(0);
    expect(analysis.cornersTransparent).toBe(false);
  });

  it("measures a genuine cutout", async () => {
    const subject = await canvas(50, OPAQUE_RED).png().toBuffer();
    const bytes = await canvas(100, TRANSPARENT)
      .composite([{ input: subject, top: 25, left: 25 }])
      .png()
      .toBuffer();
    const analysis = await analyzeImageAlpha(bytes);
    expect(analysis.hasAlphaChannel).toBe(true);
    expect(analysis.cornersTransparent).toBe(true);
    // A quarter of the frame is drawn, so ~75% should read as transparent.
    // Sampling is a downscale, so allow a couple of points of slack.
    expect(analysis.transparentShareBps).toBeGreaterThan(7300);
    expect(analysis.transparentShareBps).toBeLessThan(7700);
  });

  it("reports a fully transparent image as near-empty", async () => {
    const bytes = await canvas(64, TRANSPARENT).png().toBuffer();
    const analysis = await analyzeImageAlpha(bytes);
    expect(analysis.transparentShareBps).toBe(10_000);
    expect(analysis.cornersTransparent).toBe(true);
  });

  it("reports opaque corners when the subject bleeds to the frame edge", async () => {
    const band = await canvas(100, OPAQUE_RED).png().toBuffer();
    const bytes = await sharp({
      create: {
        width: 100,
        height: 200,
        channels: 4,
        background: TRANSPARENT,
      },
    })
      .composite([{ input: band, top: 0, left: 0 }])
      .png()
      .toBuffer();
    const analysis = await analyzeImageAlpha(bytes);
    expect(analysis.hasAlphaChannel).toBe(true);
    expect(analysis.transparentShareBps).toBeGreaterThan(4000);
    expect(analysis.cornersTransparent).toBe(false);
  });

  it("throws a typed error for bytes that are not an image", async () => {
    await expect(
      analyzeImageAlpha(new TextEncoder().encode("not an image")),
    ).rejects.toBeInstanceOf(ImageAnalysisError);
  });
});
