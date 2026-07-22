import { describe, expect, it } from "vitest";
import { saveSceneVariantFramingSchema } from "@/lib/schemas/output-variant";

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
