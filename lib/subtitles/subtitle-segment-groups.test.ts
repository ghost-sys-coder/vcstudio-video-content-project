import { describe, expect, it } from "vitest";
import { groupSegmentsByScene } from "@/lib/subtitles/subtitle-segment-groups";
import type { SubtitleSegmentView } from "@/lib/subtitles/subtitle-view";

function segment(
  overrides: Partial<SubtitleSegmentView> &
    Pick<SubtitleSegmentView, "sceneId" | "sceneNumber" | "index">,
): SubtitleSegmentView {
  return {
    key: `${overrides.sceneId}:${overrides.index}`,
    text: "Caption text",
    isOverridden: false,
    startMilliseconds: 0,
    endMilliseconds: 1000,
    durationMilliseconds: 1000,
    startFrame: 0,
    endFrame: 30,
    exceedsMaxDuration: false,
    ...overrides,
  };
}

describe("groupSegmentsByScene", () => {
  it("groups cues under their scene preserving scene and cue order", () => {
    const groups = groupSegmentsByScene([
      segment({ sceneId: "a", sceneNumber: 1, index: 0 }),
      segment({ sceneId: "a", sceneNumber: 1, index: 1 }),
      segment({ sceneId: "b", sceneNumber: 2, index: 0 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.sceneId).toBe("a");
    expect(groups[0]!.segments.map((s) => s.index)).toEqual([0, 1]);
    expect(groups[1]!.sceneId).toBe("b");
    expect(groups[1]!.segments).toHaveLength(1);
  });

  it("keeps a scene's first-seen position even if cues interleave", () => {
    const groups = groupSegmentsByScene([
      segment({ sceneId: "a", sceneNumber: 1, index: 0 }),
      segment({ sceneId: "b", sceneNumber: 2, index: 0 }),
      segment({ sceneId: "a", sceneNumber: 1, index: 1 }),
    ]);

    expect(groups.map((g) => g.sceneId)).toEqual(["a", "b"]);
    expect(groups[0]!.segments).toHaveLength(2);
  });

  it("tallies edited and long cues per scene", () => {
    const groups = groupSegmentsByScene([
      segment({ sceneId: "a", sceneNumber: 1, index: 0, isOverridden: true }),
      segment({
        sceneId: "a",
        sceneNumber: 1,
        index: 1,
        exceedsMaxDuration: true,
      }),
      segment({ sceneId: "a", sceneNumber: 1, index: 2 }),
      segment({ sceneId: "b", sceneNumber: 2, index: 0 }),
    ]);

    expect(groups[0]!.editedCount).toBe(1);
    expect(groups[0]!.longCount).toBe(1);
    expect(groups[1]!.editedCount).toBe(0);
    expect(groups[1]!.longCount).toBe(0);
  });

  it("returns an empty array for no segments", () => {
    expect(groupSegmentsByScene([])).toEqual([]);
  });
});
