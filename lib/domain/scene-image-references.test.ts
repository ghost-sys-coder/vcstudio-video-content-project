import { describe, expect, it } from "vitest";
import { assertSceneImageReferenceSelection } from "@/lib/domain/scene-image-references";

describe("assertSceneImageReferenceSelection", () => {
  it("normalizes selected reference identifiers into deterministic order", () => {
    expect(
      assertSceneImageReferenceSelection({
        selectedReferenceAssetIds: [
          "reference-c",
          "reference-a",
          "reference-b",
        ],
        eligibleReferenceAssetIds: [
          "reference-b",
          "reference-c",
          "reference-a",
        ],
      }),
    ).toEqual(["reference-a", "reference-b", "reference-c"]);
  });

  it("rejects a selected identifier missing from scoped eligible results", () => {
    expect(() =>
      assertSceneImageReferenceSelection({
        selectedReferenceAssetIds: [
          "workspace-a-reference",
          "workspace-b-reference",
        ],
        eligibleReferenceAssetIds: ["workspace-a-reference"],
      }),
    ).toThrowError("SCENE_IMAGE_REFERENCE_NOT_ELIGIBLE");
  });

  it("rejects duplicate selected identifiers", () => {
    expect(() =>
      assertSceneImageReferenceSelection({
        selectedReferenceAssetIds: ["reference-a", "reference-a"],
        eligibleReferenceAssetIds: ["reference-a"],
      }),
    ).toThrowError("DUPLICATE_SCENE_IMAGE_REFERENCE");
  });
});
