export type ResolvableSceneImage = {
  generationId: string;
  assetObjectKey: string | null;
  assetWidth: number | null;
  assetHeight: number | null;
};

export type SceneImageFraming = {
  mode: "cover" | "contain";
  focalPointXBps: number;
  focalPointYBps: number;
  scaleBps: number;
  backgroundColor: string;
};

export type StoredSceneFraming = {
  sourceImageGenerationId: string;
  mode: "cover" | "contain" | "outpaint";
  focalPointXBps: number;
  focalPointYBps: number;
  scaleBps: number;
  backgroundColor: string;
};

export type ResolvedSceneImage = {
  image: ResolvableSceneImage & { assetObjectKey: string };
  framing: SceneImageFraming;
  usedNative: boolean;
};

// Same values as lib/output-variants/scene-framing.ts's DEFAULT_SCENE_FRAMING,
// redeclared with the narrower "cover" | "contain" mode this module returns
// (never "outpaint" — that's the source framing's raw storage shape, not a
// value this resolver ever hands back).
const DEFAULT_FRAMING: SceneImageFraming = {
  mode: "cover",
  focalPointXBps: 5000,
  focalPointYBps: 5000,
  scaleBps: 10000,
  backgroundColor: "#000000",
};

/**
 * Decides which image a scene should render with, in priority order:
 * (1) a natively-generated approved image at this render's exact size — used
 *     as-is with the identity framing, no crop needed (the whole point of
 *     generating natively is to skip the crop/outpaint step for this size);
 * (2) the paid AI-outpainted image stored for this output variant, with its
 *     saved framing;
 * (3) the primary approved image, cropped/fit per its stored framing (or the
 *     default framing when none was ever saved).
 * Returns null when no image is available at all.
 */
export function resolveSceneImage(input: {
  native: ResolvableSceneImage | null;
  variantImage: ResolvableSceneImage | null;
  approvedImage: ResolvableSceneImage | null;
  storedFraming: StoredSceneFraming | null;
}): ResolvedSceneImage | null {
  const native = input.native;
  if (native?.assetObjectKey)
    return {
      image: {
        generationId: native.generationId,
        assetObjectKey: native.assetObjectKey,
        assetWidth: native.assetWidth,
        assetHeight: native.assetHeight,
      },
      framing: DEFAULT_FRAMING,
      usedNative: true,
    };

  const source = input.variantImage?.assetObjectKey
    ? input.variantImage
    : input.approvedImage;
  if (!source?.assetObjectKey) return null;
  const image = {
    generationId: source.generationId,
    assetObjectKey: source.assetObjectKey,
    assetWidth: source.assetWidth,
    assetHeight: source.assetHeight,
  };

  const framing =
    input.storedFraming &&
    input.storedFraming.sourceImageGenerationId === image.generationId
      ? {
          mode:
            input.storedFraming.mode === "outpaint"
              ? ("cover" as const)
              : input.storedFraming.mode,
          focalPointXBps: input.storedFraming.focalPointXBps,
          focalPointYBps: input.storedFraming.focalPointYBps,
          scaleBps: input.storedFraming.scaleBps,
          backgroundColor: input.storedFraming.backgroundColor,
        }
      : DEFAULT_FRAMING;

  return { image, framing, usedNative: false };
}
