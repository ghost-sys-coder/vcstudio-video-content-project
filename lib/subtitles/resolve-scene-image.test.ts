import { describe, expect, it } from "vitest";
import { resolveSceneImage } from "@/lib/subtitles/resolve-scene-image";

const nativeImage = {
  generationId: "native-gen",
  assetObjectKey: "native.webp",
  assetWidth: 1080,
  assetHeight: 1920,
};

const variantImage = {
  generationId: "variant-gen",
  assetObjectKey: "variant.webp",
  assetWidth: 1080,
  assetHeight: 1920,
};

const approvedImage = {
  generationId: "approved-gen",
  assetObjectKey: "approved.webp",
  assetWidth: 1920,
  assetHeight: 1080,
};

const storedFraming = {
  sourceImageGenerationId: "variant-gen",
  mode: "outpaint" as const,
  focalPointXBps: 6000,
  focalPointYBps: 4000,
  scaleBps: 12000,
  backgroundColor: "#111111",
};

describe("resolveSceneImage", () => {
  it("prefers a native image at the exact size, with identity framing", () => {
    const resolved = resolveSceneImage({
      native: nativeImage,
      variantImage,
      approvedImage,
      storedFraming,
    });
    expect(resolved?.usedNative).toBe(true);
    expect(resolved?.image.generationId).toBe("native-gen");
    expect(resolved?.framing).toEqual({
      mode: "cover",
      focalPointXBps: 5000,
      focalPointYBps: 5000,
      scaleBps: 10000,
      backgroundColor: "#000000",
    });
  });

  it("falls back to the outpaint variant image when no native match exists", () => {
    const resolved = resolveSceneImage({
      native: null,
      variantImage,
      approvedImage,
      storedFraming,
    });
    expect(resolved?.usedNative).toBe(false);
    expect(resolved?.image.generationId).toBe("variant-gen");
    // "outpaint" mode is displayed as "cover" (it's a full-bleed extended image).
    expect(resolved?.framing.mode).toBe("cover");
    expect(resolved?.framing.focalPointXBps).toBe(6000);
  });

  it("falls back to the primary approved image with default framing when neither native nor variant exists", () => {
    const resolved = resolveSceneImage({
      native: null,
      variantImage: null,
      approvedImage,
      storedFraming: null,
    });
    expect(resolved?.usedNative).toBe(false);
    expect(resolved?.image.generationId).toBe("approved-gen");
    expect(resolved?.framing).toEqual({
      mode: "cover",
      focalPointXBps: 5000,
      focalPointYBps: 5000,
      scaleBps: 10000,
      backgroundColor: "#000000",
    });
  });

  it("ignores a native image with no delivered asset", () => {
    const resolved = resolveSceneImage({
      native: { ...nativeImage, assetObjectKey: null },
      variantImage: null,
      approvedImage,
      storedFraming: null,
    });
    expect(resolved?.usedNative).toBe(false);
    expect(resolved?.image.generationId).toBe("approved-gen");
  });

  it("ignores stored framing that points at a different generation than the resolved image", () => {
    const resolved = resolveSceneImage({
      native: null,
      variantImage: null,
      approvedImage,
      storedFraming: { ...storedFraming, sourceImageGenerationId: "stale-gen" },
    });
    expect(resolved?.image.generationId).toBe("approved-gen");
    expect(resolved?.framing).toEqual({
      mode: "cover",
      focalPointXBps: 5000,
      focalPointYBps: 5000,
      scaleBps: 10000,
      backgroundColor: "#000000",
    });
  });

  it("returns null when nothing is available", () => {
    expect(
      resolveSceneImage({
        native: null,
        variantImage: null,
        approvedImage: null,
        storedFraming: null,
      }),
    ).toBeNull();
  });
});
