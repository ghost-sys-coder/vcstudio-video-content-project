import { describe, expect, it } from "vitest";
import {
  adjustCueBoundary,
  editCueText,
  findCueProblem,
  mergeCueWithNext,
  splitCue,
  type CaptionCue,
  type CueBounds,
} from "@/lib/subtitles/cue-editing";

const BOUNDS: CueBounds = {
  sceneDurationMilliseconds: 6000,
  minimumCueDurationMilliseconds: 400,
};

const CUES: CaptionCue[] = [
  {
    text: "The fund returned eight percent",
    startMilliseconds: 0,
    endMilliseconds: 2000,
  },
  {
    text: "which is less than it sounds",
    startMilliseconds: 2000,
    endMilliseconds: 4000,
  },
  {
    text: "once you count fees",
    startMilliseconds: 4200,
    endMilliseconds: 6000,
  },
];

describe("the invariants a track must hold", () => {
  it("accepts a sound list, gaps and all", () => {
    expect(findCueProblem(CUES, BOUNDS)).toBeNull();
  });

  it("accepts an empty list", () => {
    expect(findCueProblem([], BOUNDS)).toBeNull();
  });

  it("names a negative start", () => {
    expect(
      findCueProblem(
        [{ text: "a", startMilliseconds: -1, endMilliseconds: 500 }],
        BOUNDS,
      ),
    ).toContain("starts before the narration");
  });

  it("names an overlap and both lines involved", () => {
    const problem = findCueProblem(
      [
        { text: "a", startMilliseconds: 0, endMilliseconds: 2000 },
        { text: "b", startMilliseconds: 1500, endMilliseconds: 3000 },
      ],
      BOUNDS,
    );
    expect(problem).toContain("Line 1 overlaps line 2");
  });

  it("names a line that runs past the narration", () => {
    expect(
      findCueProblem(
        [{ text: "a", startMilliseconds: 0, endMilliseconds: 6001 }],
        BOUNDS,
      ),
    ).toContain("past the end");
  });

  it("names a line too short to read", () => {
    expect(
      findCueProblem(
        [{ text: "a", startMilliseconds: 0, endMilliseconds: 399 }],
        BOUNDS,
      ),
    ).toContain("too short to read");
  });

  it("names a line with no text, which would render as a blank flash", () => {
    expect(
      findCueProblem(
        [{ text: "   ", startMilliseconds: 0, endMilliseconds: 1000 }],
        BOUNDS,
      ),
    ).toContain("no text");
  });
});

describe("adjusting a boundary", () => {
  it("moves the edge that was dragged", () => {
    const result = adjustCueBoundary({
      cues: CUES,
      index: 0,
      edge: "end",
      milliseconds: 1500,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cues[0]?.endMilliseconds).toBe(1500);
  });

  it("refuses to drag past the next line instead of pushing it", () => {
    // Pushing the neighbour would retime a line nobody touched.
    const result = adjustCueBoundary({
      cues: CUES,
      index: 0,
      edge: "end",
      milliseconds: 2500,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("overlaps");
  });

  it("refuses a negative time rather than clamping it to zero", () => {
    const result = adjustCueBoundary({
      cues: CUES,
      index: 0,
      edge: "start",
      milliseconds: -50,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(false);
  });

  it("refuses to drag past the end of the narration", () => {
    const result = adjustCueBoundary({
      cues: CUES,
      index: 2,
      edge: "end",
      milliseconds: 6500,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(false);
  });

  it("leaves every other line exactly as it was", () => {
    const result = adjustCueBoundary({
      cues: CUES,
      index: 1,
      edge: "end",
      milliseconds: 3500,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cues[0]).toEqual(CUES[0]);
      expect(result.cues[2]).toEqual(CUES[2]);
    }
  });
});

describe("splitting a line", () => {
  it("divides the text at a word boundary and the time by character share", () => {
    const result = splitCue({
      cues: CUES,
      index: 0,
      atCharacter: 18,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cues).toHaveLength(4);
    expect(result.cues[0]?.text).toBe("The fund returned");
    expect(result.cues[1]?.text).toBe("eight percent");
    expect(result.cues[0]?.endMilliseconds).toBe(
      result.cues[1]?.startMilliseconds,
    );
    expect(findCueProblem(result.cues, BOUNDS)).toBeNull();
  });

  it("pulls an offset inside a word out to the nearest space", () => {
    const result = splitCue({
      cues: CUES,
      index: 0,
      atCharacter: 15,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cues[0]?.text).toBe("The fund returned");
  });

  it("refuses a split with nothing on one side", () => {
    const result = splitCue({
      cues: CUES,
      index: 0,
      atCharacter: 0,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("both sides");
  });

  it("refuses when a half would be too short to read", () => {
    const short: CaptionCue[] = [
      {
        text: "a much longer sentence here",
        startMilliseconds: 0,
        endMilliseconds: 600,
      },
    ];
    const result = splitCue({
      cues: short,
      index: 0,
      atCharacter: 6,
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("too short to read");
  });
});

describe("merging two lines", () => {
  it("joins the words and spans from the first start to the second end", () => {
    const result = mergeCueWithNext({ cues: CUES, index: 1, bounds: BOUNDS });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cues).toHaveLength(2);
    expect(result.cues[1]?.text).toBe(
      "which is less than it sounds once you count fees",
    );
    expect(result.cues[1]?.startMilliseconds).toBe(2000);
    expect(result.cues[1]?.endMilliseconds).toBe(6000);
  });

  it("absorbs the gap rather than leaving the caption blinking out", () => {
    const result = mergeCueWithNext({ cues: CUES, index: 1, bounds: BOUNDS });
    if (!result.ok) throw new Error(result.message);
    const merged = result.cues[1]!;
    expect(merged.endMilliseconds - merged.startMilliseconds).toBe(4000);
  });

  it("refuses on the last line, where there is nothing to merge with", () => {
    const result = mergeCueWithNext({ cues: CUES, index: 2, bounds: BOUNDS });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("no line after");
  });
});

describe("editing the words", () => {
  it("leaves the times untouched", () => {
    const result = editCueText({
      cues: CUES,
      index: 0,
      text: "The fund returned 8%",
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cues[0]?.startMilliseconds).toBe(0);
    expect(result.cues[0]?.endMilliseconds).toBe(2000);
  });

  it("refuses to empty a line", () => {
    const result = editCueText({
      cues: CUES,
      index: 0,
      text: "   ",
      bounds: BOUNDS,
    });
    expect(result.ok).toBe(false);
  });
});

describe("every operation leaves a renderable track", () => {
  it("holds after a split then a merge then an adjustment", () => {
    const split = splitCue({
      cues: CUES,
      index: 0,
      atCharacter: 18,
      bounds: BOUNDS,
    });
    if (!split.ok) throw new Error(split.message);
    const merged = mergeCueWithNext({
      cues: split.cues,
      index: 2,
      bounds: BOUNDS,
    });
    if (!merged.ok) throw new Error(merged.message);
    const adjusted = adjustCueBoundary({
      cues: merged.cues,
      index: 0,
      edge: "end",
      milliseconds: 900,
      bounds: BOUNDS,
    });
    if (!adjusted.ok) throw new Error(adjusted.message);
    expect(findCueProblem(adjusted.cues, BOUNDS)).toBeNull();
  });
});
