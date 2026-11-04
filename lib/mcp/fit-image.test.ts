import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { fitImportedImage } from "./fit-image";
describe("imported scene images", () => {
  it("preserves edge content and original bytes while fitting a wide image into a portrait canvas", async () => {
    const source = await sharp({
      create: { width: 120, height: 40, channels: 4, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const original = Buffer.from(source);
    const fitted = await fitImportedImage(source, "40x80");
    const pixels = await sharp(fitted)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    expect(pixels.info.width).toBe(40);
    expect(pixels.info.height).toBe(80);
    const pixel = (x: number, y: number) => [
      ...pixels.data.subarray((y * 40 + x) * 4, (y * 40 + x) * 4 + 4),
    ];
    expect(pixel(20, 0)[3]).toBe(0);
    expect(pixel(0, 40)).toEqual([255, 0, 0, 255]);
    expect(pixel(39, 40)).toEqual([255, 0, 0, 255]);
    expect(source).toEqual(original);
  });
  it("crops only when cover is explicitly selected", async () => {
    const source = await sharp({
      create: { width: 120, height: 40, channels: 4, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const result = await sharp(await fitImportedImage(source, "40x80", "cover"))
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(result[3]).toBe(255);
  });
});
