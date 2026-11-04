import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { fitImportedImage } from "./fit-image";
describe("imported scene images", () => {
  it("retains all four colored edges of a portrait across the accepted landscape canvas and 16:9 contain output", async () => {
    const width = 112;
    const height = 140;
    const data = Buffer.alloc(width * height * 3, 255);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const color =
          y < 8
            ? [255, 0, 0]
            : y >= height - 8
              ? [0, 255, 0]
              : x < 8
                ? [0, 0, 255]
                : x >= width - 8
                  ? [255, 255, 0]
                  : [255, 255, 255];
        data.set(color, (y * width + x) * 3);
      }
    const source = await sharp(data, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    const fitted = await fitImportedImage(source, "1536x1024");
    const output = await sharp(fitted)
      .resize(1920, 1080, { fit: "contain", background: "#000000" })
      .removeAlpha()
      .raw()
      .toBuffer();
    const pixel = (x: number, y: number) => [
      ...output.subarray((y * 1920 + x) * 3, (y * 1920 + x) * 3 + 3),
    ];
    expect(pixel(960, 8)).toEqual([255, 0, 0]);
    expect(pixel(960, 1070)).toEqual([0, 255, 0]);
    expect(pixel(540, 540)).toEqual([0, 0, 255]);
    expect(pixel(1380, 540)).toEqual([255, 255, 0]);
    expect(pixel(0, 540)).toEqual([0, 0, 0]);
  });
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
