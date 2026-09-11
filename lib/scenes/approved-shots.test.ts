import { describe, expect, it } from "vitest";
import {
  primaryImageBySceneVersion,
  shotsBySceneVersion,
} from "@/lib/scenes/approved-shots";

const ROWS = [
  { sceneVersionId: "v1", shotIndex: 2, generationId: "c" },
  { sceneVersionId: "v1", shotIndex: 0, generationId: "a" },
  { sceneVersionId: "v2", shotIndex: 0, generationId: "d" },
  { sceneVersionId: "v1", shotIndex: 1, generationId: "b" },
];

describe("the image that stands for a scene", () => {
  it("is the first shot, whatever order the rows arrived in", () => {
    // This is the regression the helper exists for: building a map straight
    // from the array kept the last row, which after ordering is the LAST shot.
    const primary = primaryImageBySceneVersion(ROWS);
    expect(primary.get("v1")?.generationId).toBe("a");
  });

  it("handles a scene with only one image", () => {
    expect(primaryImageBySceneVersion(ROWS).get("v2")?.generationId).toBe("d");
  });

  it("returns nothing for a scene with no approved image", () => {
    expect(primaryImageBySceneVersion(ROWS).get("v3")).toBeUndefined();
  });

  it("is empty for an empty list", () => {
    expect(primaryImageBySceneVersion([]).size).toBe(0);
  });
});

describe("all the images in a scene", () => {
  it("comes back in shot order", () => {
    const shots = shotsBySceneVersion(ROWS);
    expect(shots.get("v1")?.map((row) => row.generationId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps scenes apart", () => {
    const shots = shotsBySceneVersion(ROWS);
    expect(shots.get("v2")).toHaveLength(1);
    expect(shots.get("v1")).toHaveLength(3);
  });

  it("agrees with the primary image on which one is first", () => {
    const shots = shotsBySceneVersion(ROWS);
    const primary = primaryImageBySceneVersion(ROWS);
    for (const [versionId, list] of shots)
      expect(list[0]?.generationId).toBe(primary.get(versionId)?.generationId);
  });

  it("does not mutate the rows it was given", () => {
    const input = [...ROWS];
    shotsBySceneVersion(input);
    expect(input.map((row) => row.generationId)).toEqual(["c", "a", "d", "b"]);
  });
});
