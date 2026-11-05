import "server-only";
import sharp from "sharp";
/** Provider-free frame adaptation. The original workspace asset is untouched. */
export async function prepareVideoReference(input: {
  bytes: Buffer;
  mode: string;
  fit: "contain" | "cover";
  width: number;
  height: number;
}) {
  let image = sharp(input.bytes, { limitInputPixels: 40_000_000 }).rotate();
  if (input.mode === "image_to_video")
    image = image.resize({
      width: input.width,
      height: input.height,
      fit: input.fit,
      background: "#000000",
    });
  return image.png().toBuffer();
}
