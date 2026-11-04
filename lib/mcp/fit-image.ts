import sharp from "sharp";
export async function fitImportedImage(
  bytes: Uint8Array,
  size: string,
  fit: "contain" | "cover" = "contain",
) {
  const [width, height] = size.split("x").map(Number);
  if (!width || !height) throw new Error("INVALID_SCENE_IMAGE_SIZE");
  return sharp(bytes, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize(width, height, { fit, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
