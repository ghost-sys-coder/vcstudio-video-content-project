import { describe, expect, it } from "vitest";
import {
  applySceneVariantFramingSchema,
  saveSceneVariantFramingSchema,
} from "@/lib/schemas/output-variant";

const id = "11111111-1111-4111-8111-111111111111";

describe("saveSceneVariantFramingSchema", () => {
  it("accepts bounded deterministic framing input", () => {
    const result = saveSceneVariantFramingSchema.safeParse({
      projectId: id,
      outputVariantId: id,
      sceneId: id,
      sceneVersionId: id,
      sourceImageGenerationId: id,
      mode: "cover",
      focalPointXBps: "2500",
      focalPointYBps: "7500",
      scaleBps: "12500",
      backgroundColor: "#AABBCC",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.backgroundColor).toBe("#aabbcc");
  });

  it("rejects paid outpainting as an ordinary framing mutation", () => {
    const result = saveSceneVariantFramingSchema.safeParse({
      projectId: id,
      outputVariantId: id,
      sceneId: id,
      sceneVersionId: id,
      sourceImageGenerationId: id,
      mode: "outpaint",
      focalPointXBps: 5000,
      focalPointYBps: 5000,
      scaleBps: 10000,
      backgroundColor: "#000000",
    });
    expect(result.success).toBe(false);
  });
});

describe("applySceneVariantFramingSchema", () => {
  const target = {
    sceneId: id,
    sceneVersionId: id,
    sourceImageGenerationId: id,
  };

  it("accepts one shared framing with at least one target scene", () => {
    const result = applySceneVariantFramingSchema.safeParse({
      projectId: id,
      outputVariantId: id,
      mode: "cover",
      focalPointXBps: 5000,
      focalPointYBps: 5000,
      scaleBps: 10000,
      backgroundColor: "#000000",
      targets: [target],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty target list", () => {
    const result = applySceneVariantFramingSchema.safeParse({
      projectId: id,
      outputVariantId: id,
      mode: "cover",
      focalPointXBps: 5000,
      focalPointYBps: 5000,
      scaleBps: 10000,
      backgroundColor: "#000000",
      targets: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 target scenes", () => {
    const result = applySceneVariantFramingSchema.safeParse({
      projectId: id,
      outputVariantId: id,
      mode: "cover",
      focalPointXBps: 5000,
      focalPointYBps: 5000,
      scaleBps: 10000,
      backgroundColor: "#000000",
      targets: Array.from({ length: 51 }, () => target),
    });
    expect(result.success).toBe(false);
  });
});
