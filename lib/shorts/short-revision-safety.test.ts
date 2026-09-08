import { describe, expect, it } from "vitest";
import { shortNeedsRangeReview } from "./short-revision-safety";

const rows = [1, 2, 3].map((n) => ({
  scene: { id: `scene-${n}`, sceneNumber: n },
  version: { id: `version-${n}`, createdAt: new Date(1000) },
}));
const clips = [
  {
    sourceSceneId: "scene-2",
    sourceSceneVersionId: "version-2",
    createdAt: new Date(2000),
  },
];
describe("legacy Short revision safety", () => {
  it("keeps an untouched clip valid", () =>
    expect(shortNeedsRangeReview(clips, rows)).toBe(false));
  it("blocks an earlier edit that may shift an otherwise in-bounds range", () => {
    const changed = structuredClone(rows);
    changed[0]!.version.createdAt = new Date(3000);
    expect(shortNeedsRangeReview(clips, changed)).toBe(true);
  });
  it("does not block for edits after the source", () => {
    const changed = structuredClone(rows);
    changed[2]!.version.createdAt = new Date(3000);
    expect(shortNeedsRangeReview(clips, changed)).toBe(false);
  });
  it("blocks a replaced or missing source", () => {
    expect(
      shortNeedsRangeReview(
        [{ ...clips[0]!, sourceSceneVersionId: "old" }],
        rows,
      ),
    ).toBe(true);
    expect(shortNeedsRangeReview(clips, [])).toBe(true);
  });
  it("accepts ranges reviewed after the revision", () => {
    const changed = structuredClone(rows);
    changed[0]!.version.createdAt = new Date(3000);
    expect(
      shortNeedsRangeReview(
        [{ ...clips[0]!, createdAt: new Date(4000) }],
        changed,
      ),
    ).toBe(false);
  });
});
