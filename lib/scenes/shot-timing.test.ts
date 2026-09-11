import { describe, expect, it } from "vitest";
import { placeShotsOnCueBoundaries } from "@/lib/scenes/shot-timing";

/** Four caption lines across a twelve-second scene. */
const CUE_STARTS = [0, 3400, 6100, 9200];

const BASE = {
  sceneDurationMilliseconds: 12_000,
  cueStartMilliseconds: CUE_STARTS,
  minimumShotDurationMilliseconds: 800,
};

describe("a scene with one image", () => {
  it("keeps that image for the whole scene", () => {
    const result = placeShotsOnCueBoundaries({ ...BASE, shotCount: 1 });
    expect(result.shots).toHaveLength(1);
    expect(result.shots[0]?.startMilliseconds).toBe(0);
    expect(result.shots[0]?.endMilliseconds).toBe(12_000);
  });

  it("reports no boundaries rather than claiming a caption placement", () => {
    const result = placeShotsOnCueBoundaries({ ...BASE, shotCount: 1 });
    expect(result.interiorBoundaryCount).toBe(0);
    expect(result.cuePlacedBoundaryCount).toBe(0);
  });
});

describe("changing image on a caption boundary", () => {
  it("puts the change on the caption nearest the middle", () => {
    // Even division wants 6000. The nearest caption change is 6100.
    const result = placeShotsOnCueBoundaries({ ...BASE, shotCount: 2 });
    expect(result.shots[0]?.endMilliseconds).toBe(6100);
    expect(result.shots[1]?.startMilliseconds).toBe(6100);
    expect(result.cuePlacedBoundaryCount).toBe(1);
  });

  it("marks a shot as following the narration only when it truly does", () => {
    const result = placeShotsOnCueBoundaries({ ...BASE, shotCount: 2 });
    expect(result.shots[1]?.startedOnCueBoundary).toBe(true);
    // The first shot starts with the scene, which is not a caption change.
    expect(result.shots[0]?.startedOnCueBoundary).toBe(false);
  });

  it("uses a different caption for each change, never the same one twice", () => {
    const result = placeShotsOnCueBoundaries({ ...BASE, shotCount: 3 });
    const starts = result.shots.map((shot) => shot.startMilliseconds);
    expect(new Set(starts).size).toBe(3);
    expect(result.cuePlacedBoundaryCount).toBe(2);
  });

  it("ignores the caption that starts with the scene", () => {
    // Changing image at zero would mean the first image never appears.
    const result = placeShotsOnCueBoundaries({ ...BASE, shotCount: 2 });
    expect(result.shots[0]?.endMilliseconds).toBeGreaterThan(0);
  });
});

describe("when the captions cannot carry the changes", () => {
  it("divides evenly and says so when there are no captions at all", () => {
    const result = placeShotsOnCueBoundaries({
      ...BASE,
      cueStartMilliseconds: [],
      shotCount: 2,
    });
    expect(result.shots[0]?.endMilliseconds).toBe(6000);
    expect(result.cuePlacedBoundaryCount).toBe(0);
    expect(result.interiorBoundaryCount).toBe(1);
  });

  it("places what it can and reports the rest as evenly divided", () => {
    // Three shots need two changes, but only one caption boundary exists.
    const result = placeShotsOnCueBoundaries({
      ...BASE,
      cueStartMilliseconds: [0, 6100],
      shotCount: 3,
    });
    expect(result.interiorBoundaryCount).toBe(2);
    expect(result.cuePlacedBoundaryCount).toBe(1);
    expect(
      result.shots.filter((shot) => shot.startedOnCueBoundary),
    ).toHaveLength(1);
  });

  it("keeps one image when the scene is too short to show them all", () => {
    // Four images across two seconds is not a faster version of the intent.
    const result = placeShotsOnCueBoundaries({
      sceneDurationMilliseconds: 2000,
      cueStartMilliseconds: [0, 500, 1000, 1500],
      minimumShotDurationMilliseconds: 800,
      shotCount: 4,
    });
    expect(result.shots).toHaveLength(1);
    expect(result.shots[0]?.endMilliseconds).toBe(2000);
  });
});

describe("what a placement must never produce", () => {
  const cases = [
    { shotCount: 2, cues: CUE_STARTS },
    { shotCount: 3, cues: CUE_STARTS },
    { shotCount: 4, cues: CUE_STARTS },
    { shotCount: 3, cues: [] as number[] },
    { shotCount: 2, cues: [0, 100, 11_900] },
    { shotCount: 5, cues: [0, 200, 400, 600, 800, 11_000] },
  ];

  it("covers the scene exactly, with no gap and no overlap", () => {
    for (const { shotCount, cues } of cases) {
      const result = placeShotsOnCueBoundaries({
        ...BASE,
        cueStartMilliseconds: cues,
        shotCount,
      });
      expect(result.shots[0]?.startMilliseconds).toBe(0);
      expect(result.shots[result.shots.length - 1]?.endMilliseconds).toBe(
        12_000,
      );
      for (let index = 0; index < result.shots.length - 1; index += 1)
        expect(result.shots[index]?.endMilliseconds).toBe(
          result.shots[index + 1]?.startMilliseconds,
        );
    }
  });

  it("never leaves an image on screen for less than the minimum", () => {
    for (const { shotCount, cues } of cases) {
      const result = placeShotsOnCueBoundaries({
        ...BASE,
        cueStartMilliseconds: cues,
        shotCount,
      });
      for (const shot of result.shots)
        expect(
          shot.endMilliseconds - shot.startMilliseconds,
        ).toBeGreaterThanOrEqual(800);
    }
  });

  it("keeps the shots in order", () => {
    for (const { shotCount, cues } of cases) {
      const result = placeShotsOnCueBoundaries({
        ...BASE,
        cueStartMilliseconds: cues,
        shotCount,
      });
      const starts = result.shots.map((shot) => shot.startMilliseconds);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      expect(result.shots.map((shot) => shot.shotIndex)).toEqual(
        result.shots.map((_, index) => index),
      );
    }
  });

  it("is deterministic, because a render must reproduce", () => {
    const first = placeShotsOnCueBoundaries({ ...BASE, shotCount: 3 });
    const second = placeShotsOnCueBoundaries({ ...BASE, shotCount: 3 });
    expect(first).toEqual(second);
  });
});

describe("odd inputs", () => {
  it("treats a zero-length scene as a single shot", () => {
    const result = placeShotsOnCueBoundaries({
      ...BASE,
      sceneDurationMilliseconds: 0,
      shotCount: 3,
    });
    expect(result.shots).toHaveLength(1);
  });

  it("ignores caption starts outside the scene", () => {
    const result = placeShotsOnCueBoundaries({
      ...BASE,
      cueStartMilliseconds: [-500, 0, 6100, 20_000],
      shotCount: 2,
    });
    expect(result.shots[0]?.endMilliseconds).toBe(6100);
  });

  it("treats a shot count below one as one", () => {
    const result = placeShotsOnCueBoundaries({ ...BASE, shotCount: 0 });
    expect(result.shots).toHaveLength(1);
  });
});
