import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { prepareVideoReference } from "./prepare-video-reference";
describe("full-image provider input fitting", () => {
  it("contains the whole portrait in the target frame while preserving the original", async () => {
    const original = await sharp({
      create: { width: 100, height: 200, channels: 3, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const output = await prepareVideoReference({
      bytes: original,
      mode: "image_to_video",
      fit: "contain",
      width: 640,
      height: 360,
    });
    expect(await sharp(original).metadata()).toMatchObject({
      width: 100,
      height: 200,
    });
    expect(await sharp(output).metadata()).toMatchObject({
      width: 640,
      height: 360,
    });
    const left = await sharp(output)
      .extract({ left: 0, top: 180, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();
    const center = await sharp(output)
      .extract({ left: 320, top: 180, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();
    expect([...left]).toEqual([0, 0, 0]);
    expect([...center]).toEqual([255, 0, 0]);
    const cropped = await prepareVideoReference({
      bytes: original,
      mode: "image_to_video",
      fit: "cover",
      width: 640,
      height: 360,
    });
    expect([
      ...(await sharp(cropped)
        .extract({ left: 0, top: 180, width: 1, height: 1 })
        .removeAlpha()
        .raw()
        .toBuffer()),
    ]).toEqual([255, 0, 0]);
  });
  it("preserves reference proportions outside first/last-frame mode and rejects disguised files", async () => {
    const original = await sharp({
      create: { width: 100, height: 200, channels: 3, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    expect(
      await sharp(
        await prepareVideoReference({
          bytes: original,
          mode: "reference_to_video",
          fit: "contain",
          width: 640,
          height: 360,
        }),
      ).metadata(),
    ).toMatchObject({ width: 100, height: 200 });
    await expect(
      prepareVideoReference({
        bytes: Buffer.from("not an image"),
        mode: "image_to_video",
        fit: "contain",
        width: 640,
        height: 360,
      }),
    ).rejects.toThrow();
  });
});
