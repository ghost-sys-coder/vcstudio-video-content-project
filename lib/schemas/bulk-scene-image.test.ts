import { describe, expect, it } from "vitest";
import {
  cancelSceneImageBatchSchema,
  startBulkSceneImageGenerationSchema,
} from "@/lib/schemas/bulk-scene-image";

const VALID = {
  projectId: "11111111-1111-4111-8111-111111111111",
  stylePresetVersionId: "22222222-2222-4222-8222-222222222222",
  quality: "low",
  requestNonce: "33333333-3333-4333-8333-333333333333",
  sceneIds: [
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ],
};

describe("startBulkSceneImageGenerationSchema", () => {
  it("accepts a well-formed request", () => {
    const parsed = startBulkSceneImageGenerationSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty scene selection", () => {
    const parsed = startBulkSceneImageGenerationSchema.safeParse({
      ...VALID,
      sceneIds: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate scene ids (duplicate submission guard)", () => {
    const parsed = startBulkSceneImageGenerationSchema.safeParse({
      ...VALID,
      sceneIds: [VALID.sceneIds[0], VALID.sceneIds[0]],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects selections beyond the hard schema cap", () => {
    const sceneIds = Array.from(
      { length: 201 },
      (_unused, index) =>
        `66666666-6666-4666-8666-${index.toString().padStart(12, "0")}`,
    );
    const parsed = startBulkSceneImageGenerationSchema.safeParse({
      ...VALID,
      sceneIds,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown quality", () => {
    const parsed = startBulkSceneImageGenerationSchema.safeParse({
      ...VALID,
      quality: "ultra",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("cancelSceneImageBatchSchema", () => {
  it("accepts a project and batch id", () => {
    const parsed = cancelSceneImageBatchSchema.safeParse({
      projectId: VALID.projectId,
      batchId: VALID.requestNonce,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing batch id", () => {
    const parsed = cancelSceneImageBatchSchema.safeParse({
      projectId: VALID.projectId,
    });
    expect(parsed.success).toBe(false);
  });
});
