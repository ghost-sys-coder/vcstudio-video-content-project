import { describe, expect, it } from "vitest";
import type { SceneNavigationRow } from "@/lib/scenes/scene-navigation";
import {
  filterSceneRows,
  findInitialSceneId,
  getAdjacentSceneId,
} from "@/lib/scenes/scene-navigation";

const rows = [
  {
    scene: { id: "one", sceneNumber: 1, status: "approved" },
    version: {
      narrationText: "Opening narration",
      visualDescription: "A city skyline",
    },
  },
  {
    scene: { id: "two", sceneNumber: 2, status: "draft" },
    version: {
      narrationText: "Debt explained",
      visualDescription: "A bank interior",
    },
  },
] as unknown as SceneNavigationRow[];

describe("scene navigation", () => {
  it("selects the requested scene number and falls back to the first scene", () => {
    expect(findInitialSceneId(rows, 2)).toBe("two");
    expect(findInitialSceneId(rows, 99)).toBe("one");
    expect(findInitialSceneId([], 1)).toBeNull();
  });

  it("filters scenes by status and searchable content", () => {
    expect(filterSceneRows(rows, "bank", "all")).toHaveLength(1);
    expect(filterSceneRows(rows, "", "approved")).toHaveLength(1);
    expect(filterSceneRows(rows, "2", "draft")[0]?.scene.id).toBe("two");
  });

  it("returns bounded adjacent scene identifiers", () => {
    expect(getAdjacentSceneId(rows, "one", "next")).toBe("two");
    expect(getAdjacentSceneId(rows, "one", "previous")).toBeNull();
    expect(getAdjacentSceneId(rows, "two", "next")).toBeNull();
  });
});
