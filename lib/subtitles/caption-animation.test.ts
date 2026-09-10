import { describe, expect, it } from "vitest";
import {
  CAPTION_SLIDE_DISTANCE_PERCENT,
  resolveCaptionAnimation,
  resolveCaptionAnimationFrames,
} from "@/lib/subtitles/caption-animation";
import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";

type AnimationStyle = Pick<
  CaptionStyleData,
  | "entranceEffect"
  | "entranceDirection"
  | "entranceDurationMilliseconds"
  | "exitMatchesEntrance"
>;

const slideUp: AnimationStyle = {
  entranceEffect: "slide-fade",
  entranceDirection: "bottom",
  entranceDurationMilliseconds: 250,
  exitMatchesEntrance: true,
};

/** A cue from frame 0 to 120 at 30fps, four seconds long. */
const cue = { frame: 0, startFrame: 0, endFrame: 120, fps: 30 };

describe("a cut stays a cut", () => {
  it("does nothing at all when the effect is none", () => {
    // The default. An untouched project must render exactly as before.
    for (const frame of [0, 1, 60, 119])
      expect(
        resolveCaptionAnimation({
          ...cue,
          frame,
          style: { ...slideUp, entranceEffect: "none" },
        }),
      ).toEqual({ opacity: 1, translateXPercent: 0, translateYPercent: 0 });
  });
});

describe("arriving and leaving", () => {
  it("starts invisible and offset, and settles", () => {
    const first = resolveCaptionAnimation({ ...cue, frame: 0, style: slideUp });
    expect(first.opacity).toBe(0);
    expect(first.translateYPercent).toBe(CAPTION_SLIDE_DISTANCE_PERCENT);

    const settled = resolveCaptionAnimation({
      ...cue,
      frame: 60,
      style: slideUp,
    });
    expect(settled.opacity).toBe(1);
    expect(settled.translateYPercent).toBe(0);
  });

  it("travels from the named edge", () => {
    const from = (direction: CaptionStyleData["entranceDirection"]) =>
      resolveCaptionAnimation({
        ...cue,
        frame: 0,
        style: { ...slideUp, entranceDirection: direction },
      });
    expect(from("bottom").translateYPercent).toBeGreaterThan(0);
    expect(from("top").translateYPercent).toBeLessThan(0);
    expect(from("left").translateXPercent).toBeLessThan(0);
    expect(from("right").translateXPercent).toBeGreaterThan(0);
  });

  it("fades without moving when the effect is a plain fade", () => {
    const frame = resolveCaptionAnimation({
      ...cue,
      frame: 0,
      style: { ...slideUp, entranceEffect: "fade" },
    });
    expect(frame.opacity).toBe(0);
    expect(frame.translateXPercent).toBe(0);
    expect(frame.translateYPercent).toBe(0);
  });

  it("leaves the same way when asked, and does not when not", () => {
    const leaving = resolveCaptionAnimation({
      ...cue,
      frame: 119,
      style: slideUp,
    });
    expect(leaving.opacity).toBeLessThan(1);

    const staying = resolveCaptionAnimation({
      ...cue,
      frame: 119,
      style: { ...slideUp, exitMatchesEntrance: false },
    });
    expect(staying.opacity).toBe(1);
    expect(staying.translateYPercent).toBe(0);
  });

  it("rises monotonically while arriving", () => {
    let previous = -1;
    for (let frame = 0; frame <= 8; frame += 1) {
      const { opacity } = resolveCaptionAnimation({
        ...cue,
        frame,
        style: slideUp,
      });
      expect(opacity).toBeGreaterThanOrEqual(previous);
      previous = opacity;
    }
  });
});

describe("a very short cue is never broken by its own animation", () => {
  it("never begins leaving before it has finished arriving", () => {
    // The guard that matters: a cue shorter than entrance plus exit would
    // otherwise flicker without ever being fully readable.
    const short = { frame: 0, startFrame: 0, endFrame: 6, fps: 30 };
    const { entranceFrames, exitFrames } = resolveCaptionAnimationFrames({
      entranceDurationMilliseconds: 250,
      exitMatchesEntrance: true,
      cueFrames: 6,
      fps: 30,
    });
    expect(entranceFrames + exitFrames).toBeLessThanOrEqual(6);

    // And it does reach full opacity somewhere in the middle.
    const peak = Math.max(
      ...Array.from(
        { length: 6 },
        (_, frame) =>
          resolveCaptionAnimation({ ...short, frame, style: slideUp }).opacity,
      ),
    );
    expect(peak).toBe(1);
  });

  it("gives a one-frame cue nothing to animate rather than a flicker", () => {
    const frames = resolveCaptionAnimationFrames({
      entranceDurationMilliseconds: 250,
      exitMatchesEntrance: true,
      cueFrames: 1,
      fps: 30,
    });
    expect(frames).toEqual({ entranceFrames: 0, exitFrames: 0 });
    expect(
      resolveCaptionAnimation({
        frame: 0,
        startFrame: 0,
        endFrame: 1,
        fps: 30,
        style: slideUp,
      }).opacity,
    ).toBe(1);
  });

  it("treats a zero duration as no animation", () => {
    expect(
      resolveCaptionAnimation({
        ...cue,
        frame: 0,
        style: { ...slideUp, entranceDurationMilliseconds: 0 },
      }).opacity,
    ).toBe(1);
  });
});
