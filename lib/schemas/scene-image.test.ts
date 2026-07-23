import { describe, expect, it } from "vitest";
import {
  getAspectRatioForSceneImageSize,
  getSceneImageDimensions,
  getSceneImageSizeForAspectRatio,
  sceneImageProviderConfigurationSchema,
  startSceneImageGenerationSchema,
  uniqueSceneImageSizesSchema,
} from "@/lib/schemas/scene-image";

const ids = {
  projectId: "00000000-0000-4000-8000-000000000001",
  sceneId: "00000000-0000-4000-8000-000000000002",
  sceneVersionId: "00000000-0000-4000-8000-000000000003",
  stylePresetVersionId: "00000000-0000-4000-8000-000000000004",
  requestNonce: "00000000-0000-4000-8000-000000000005",
};

describe("scene image schemas", () => {
  it("accepts multiple approved API sizes and sorts references", () => {
    const result = startSceneImageGenerationSchema.parse({
      ...ids,
      quality: "low",
      sizes: ["1536x1024", "1024x1024"],
      referenceAssetIds: [
        "00000000-0000-4000-8000-000000000012",
        "00000000-0000-4000-8000-000000000011",
      ],
    });
    expect(result.sizes).toEqual(["1536x1024", "1024x1024"]);
    expect(result.referenceAssetIds).toEqual([
      "00000000-0000-4000-8000-000000000011",
      "00000000-0000-4000-8000-000000000012",
    ]);
    expect(
      startSceneImageGenerationSchema.safeParse({
        ...ids,
        quality: "low",
        sizes: ["1536x864"],
        referenceAssetIds: [],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty size selection", () => {
    expect(
      startSceneImageGenerationSchema.safeParse({
        ...ids,
        quality: "low",
        sizes: [],
        referenceAssetIds: [],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate references and invalid compression", () => {
    const referenceId = "00000000-0000-4000-8000-000000000011";
    expect(
      startSceneImageGenerationSchema.safeParse({
        ...ids,
        quality: "medium",
        sizes: ["1024x1024"],
        referenceAssetIds: [referenceId, referenceId],
      }).success,
    ).toBe(false);
    expect(
      sceneImageProviderConfigurationSchema.safeParse({
        model: "gpt-image-2",
        prompt: "Draw the scene.",
        quality: "medium",
        size: "1024x1024",
        outputFormat: "webp",
        outputCompression: 101,
        background: "opaque",
      }).success,
    ).toBe(false);
  });

  it("maps project aspect ratios to supported API dimensions and back", () => {
    expect(getSceneImageSizeForAspectRatio("16:9")).toBe("1536x1024");
    expect(getSceneImageSizeForAspectRatio("9:16")).toBe("1024x1536");
    expect(getSceneImageSizeForAspectRatio("1:1")).toBe("1024x1024");
    expect(getSceneImageDimensions("1024x1536")).toEqual({
      width: 1024,
      height: 1536,
    });
    expect(getAspectRatioForSceneImageSize("1536x1024")).toBe("16:9");
    expect(getAspectRatioForSceneImageSize("1024x1536")).toBe("9:16");
    expect(getAspectRatioForSceneImageSize("1024x1024")).toBe("1:1");
  });

  it("round-trips every aspect ratio through size and back", () => {
    for (const aspectRatio of ["16:9", "9:16", "1:1"] as const) {
      expect(
        getAspectRatioForSceneImageSize(
          getSceneImageSizeForAspectRatio(aspectRatio),
        ),
      ).toBe(aspectRatio);
    }
  });

  describe("uniqueSceneImageSizesSchema", () => {
    it("rejects duplicate sizes", () => {
      expect(
        uniqueSceneImageSizesSchema.safeParse(["1536x1024", "1536x1024"])
          .success,
      ).toBe(false);
    });

    it("accepts up to all three sizes", () => {
      expect(
        uniqueSceneImageSizesSchema.safeParse([
          "1536x1024",
          "1024x1536",
          "1024x1024",
        ]).success,
      ).toBe(true);
    });

    it("rejects an empty array", () => {
      expect(uniqueSceneImageSizesSchema.safeParse([]).success).toBe(false);
    });
  });
});
