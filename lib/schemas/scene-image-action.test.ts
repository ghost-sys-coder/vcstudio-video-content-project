import { describe, expect, it } from "vitest";
import {
  sceneImageAssetRouteParamsSchema,
  sceneImageDetailsQuerySchema,
  sceneImageGenerationMutationSchema,
} from "@/lib/schemas/scene-image-action";

const projectId = "11111111-1111-4111-8111-111111111111";
const generationId = "22222222-2222-4222-8222-222222222222";

describe("scene image action schemas", () => {
  it("accepts scoped generation mutations", () => {
    expect(
      sceneImageGenerationMutationSchema.parse({ projectId, generationId }),
    ).toEqual({ projectId, generationId });
  });

  it("rejects malformed route identifiers", () => {
    expect(
      sceneImageAssetRouteParamsSchema.safeParse({
        projectId,
        generationId: "not-a-generation",
      }).success,
    ).toBe(false);
  });

  it("requires the exact scene version in lazy detail requests", () => {
    expect(
      sceneImageDetailsQuerySchema.safeParse({ sceneVersionId: null }).success,
    ).toBe(false);
  });
});
