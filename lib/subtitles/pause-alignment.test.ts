import { describe, expect, it } from "vitest";
import {
  findSilenceWindows,
  snapBoundariesToPauses,
} from "@/lib/subtitles/pause-alignment";

/** 50 Hz, matching the stored envelope rate: one sample is 20ms. */
const RATE = 50;

function envelope(spans: { loud: boolean; milliseconds: number }[]): number[] {
  const values: number[] = [];
  for (const span of spans) {
    const samples = Math.round((span.milliseconds / 1000) * RATE);
    for (let index = 0; index < samples; index += 1)
      values.push(span.loud ? 70 : 2);
  }
  return values;
}

describe("finding the quiet stretches", () => {
  it("reports a pause between two spoken runs", () => {
    const windows = findSilenceWindows({
      envelope: envelope([
        { loud: true, milliseconds: 1000 },
        { loud: false, milliseconds: 400 },
        { loud: true, milliseconds: 1000 },
      ]),
      sampleRateHz: RATE,
    });
    expect(windows).toEqual([
      { startMilliseconds: 1000, endMilliseconds: 1400 },
    ]);
  });

  it("ignores a dip too brief to be a pause between phrases", () => {
    // 60ms is the gap between syllables, not a place to break a caption.
    expect(
      findSilenceWindows({
        envelope: envelope([
          { loud: true, milliseconds: 1000 },
          { loud: false, milliseconds: 60 },
          { loud: true, milliseconds: 1000 },
        ]),
        sampleRateHz: RATE,
      }),
    ).toEqual([]);
  });

  it("reports leading silence, which is where a first caption should not start", () => {
    const windows = findSilenceWindows({
      envelope: envelope([
        { loud: false, milliseconds: 500 },
        { loud: true, milliseconds: 1000 },
      ]),
      sampleRateHz: RATE,
    });
    expect(windows[0]).toEqual({ startMilliseconds: 0, endMilliseconds: 500 });
  });

  it("returns nothing for a missing or unusable envelope", () => {
    expect(findSilenceWindows({ envelope: [], sampleRateHz: RATE })).toEqual(
      [],
    );
    expect(
      findSilenceWindows({ envelope: [0, 0, 0], sampleRateHz: 0 }),
    ).toEqual([]);
  });
});

describe("moving a boundary onto a pause", () => {
  const silences = [{ startMilliseconds: 1900, endMilliseconds: 2300 }];

  it("snaps a nearly-right boundary to the middle of the pause", () => {
    const result = snapBoundariesToPauses({
      boundaries: [2000],
      silences,
      sceneDurationMilliseconds: 5000,
      minimumCueDurationMilliseconds: 400,
    });
    expect(result.boundaries).toEqual([2100]);
    expect(result.movedCount).toBe(1);
  });

  it("leaves a boundary alone when the nearest pause is too far away", () => {
    // Bounded movement is the safeguard: a distant pause belongs to another
    // phrase, and dragging a break onto it would be worse than the estimate.
    const result = snapBoundariesToPauses({
      boundaries: [3200],
      silences,
      sceneDurationMilliseconds: 5000,
      minimumCueDurationMilliseconds: 400,
    });
    expect(result.boundaries).toEqual([3200]);
    expect(result.movedCount).toBe(0);
  });

  it("reports nothing moved when there are no pauses at all", () => {
    const result = snapBoundariesToPauses({
      boundaries: [2000, 3500],
      silences: [],
      sceneDurationMilliseconds: 5000,
      minimumCueDurationMilliseconds: 400,
    });
    expect(result.boundaries).toEqual([2000, 3500]);
    expect(result.movedCount).toBe(0);
  });
});

describe("what two boundaries may not do to each other", () => {
  it("never lets both collapse onto the same pause", () => {
    const result = snapBoundariesToPauses({
      boundaries: [2000, 2200],
      silences: [{ startMilliseconds: 2050, endMilliseconds: 2250 }],
      sceneDurationMilliseconds: 6000,
      minimumCueDurationMilliseconds: 400,
    });
    expect(new Set(result.boundaries).size).toBe(2);
    expect(result.boundaries[0]).toBeLessThan(result.boundaries[1]!);
  });

  it("keeps the result ascending", () => {
    const result = snapBoundariesToPauses({
      boundaries: [1000, 2000, 3000],
      silences: [
        { startMilliseconds: 2800, endMilliseconds: 3200 },
        { startMilliseconds: 900, endMilliseconds: 1300 },
        { startMilliseconds: 1900, endMilliseconds: 2200 },
      ],
      sceneDurationMilliseconds: 6000,
      minimumCueDurationMilliseconds: 400,
    });
    const sorted = [...result.boundaries].sort((a, b) => a - b);
    expect(result.boundaries).toEqual(sorted);
  });

  it("never leaves a cue shorter than the minimum, at either end", () => {
    const result = snapBoundariesToPauses({
      boundaries: [500, 1000],
      silences: [
        { startMilliseconds: 0, endMilliseconds: 300 },
        { startMilliseconds: 2700, endMilliseconds: 3000 },
      ],
      sceneDurationMilliseconds: 3000,
      minimumCueDurationMilliseconds: 800,
    });
    const edges = [0, ...result.boundaries, 3000];
    for (let index = 0; index < edges.length - 1; index += 1)
      expect(edges[index + 1]! - edges[index]!).toBeGreaterThanOrEqual(800);
  });

  it("leaves the boundaries untouched when there is no room to place them", () => {
    const result = snapBoundariesToPauses({
      boundaries: [500],
      silences: [{ startMilliseconds: 400, endMilliseconds: 700 }],
      sceneDurationMilliseconds: 1000,
      minimumCueDurationMilliseconds: 900,
    });
    expect(result.boundaries).toEqual([500]);
    expect(result.movedCount).toBe(0);
  });
});
