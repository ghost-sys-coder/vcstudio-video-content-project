import { describe, expect, it } from "vitest";
import {
  getSceneImageDimensions,
  getSceneImageSizeForAspectRatio,
  sceneImageProviderConfigurationSchema,
  startSceneImageGenerationSchema,
} from "@/lib/schemas/scene-image";

const ids = {
  projectId: "00000000-0000-4000-8000-000000000001",
  sceneId: "00000000-0000-4000-8000-000000000002",
  sceneVersionId: "00000000-0000-4000-8000-000000000003",
  stylePresetVersionId: "00000000-0000-4000-8000-000000000004",
  requestNonce: "00000000-0000-4000-8000-000000000005",
};

describe("scene image schemas", () => {
  it("accepts only the three approved API sizes and sorts references", () => {
    const result = startSceneImageGenerationSchema.parse({
      ...ids,
      quality: "low",
      size: "1536x1024",
      referenceAssetIds: [
        "00000000-0000-4000-8000-000000000012",
        "00000000-0000-4000-8000-000000000011",
      ],
    });
    expect(result.referenceAssetIds).toEqual([
      "00000000-0000-4000-8000-000000000011",
      "00000000-0000-4000-8000-000000000012",
    ]);
    expect(
      startSceneImageGenerationSchema.safeParse({
        ...result,
        size: "1536x864",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate references and invalid compression", () => {
    const referenceId = "00000000-0000-4000-8000-000000000011";
    expect(
      startSceneImageGenerationSchema.safeParse({
        ...ids,
        quality: "medium",
        size: "1024x1024",
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

  it("maps project aspect ratios to supported API dimensions", () => {
    expect(getSceneImageSizeForAspectRatio("16:9")).toBe("1536x1024");
    expect(getSceneImageSizeForAspectRatio("9:16")).toBe("1024x1536");
    expect(getSceneImageSizeForAspectRatio("1:1")).toBe("1024x1024");
    expect(getSceneImageDimensions("1024x1536")).toEqual({
      width: 1024,
      height: 1536,
    });
  });
});
