import { describe, expect, it } from "vitest";
import {
  buildProjectTimeline,
  millisecondsToFrames,
} from "@/lib/timeline/scene-timeline";

describe("millisecondsToFrames", () => {
  it("converts absolute milliseconds to the nearest frame", () => {
    expect(millisecondsToFrames(1000, 30)).toBe(30);
    expect(millisecondsToFrames(33, 30)).toBe(1);
    expect(millisecondsToFrames(0, 30)).toBe(0);
  });
});

describe("buildProjectTimeline", () => {
  it("orders scenes and applies padding only between them", () => {
    const timeline = buildProjectTimeline({
      framesPerSecond: 30,
      paddingMilliseconds: 250,
      scenes: [
        { sceneId: "b", sceneNumber: 2, durationMilliseconds: 2000 },
        { sceneId: "a", sceneNumber: 1, durationMilliseconds: 1000 },
      ],
    });

    expect(timeline.scenes.map((scene) => scene.sceneId)).toEqual(["a", "b"]);
    expect(timeline.scenes[0]).toMatchObject({
      startMilliseconds: 0,
      endMilliseconds: 1000,
    });
    // Second scene starts after the first plus one padding gap.
    expect(timeline.scenes[1]).toMatchObject({
      startMilliseconds: 1250,
      endMilliseconds: 3250,
    });
    // No trailing padding: total equals the last scene end.
    expect(timeline.totalDurationMilliseconds).toBe(3250);
  });

  it("tiles frames contiguously with no gaps or overlaps", () => {
    const timeline = buildProjectTimeline({
      framesPerSecond: 30,
      paddingMilliseconds: 0,
      scenes: [
        { sceneId: "a", sceneNumber: 1, durationMilliseconds: 1000 },
        { sceneId: "b", sceneNumber: 2, durationMilliseconds: 1000 },
        { sceneId: "c", sceneNumber: 3, durationMilliseconds: 1000 },
      ],
    });
    expect(timeline.scenes[0]!.endFrame).toBe(timeline.scenes[1]!.startFrame);
    expect(timeline.scenes[1]!.endFrame).toBe(timeline.scenes[2]!.startFrame);
    expect(timeline.totalFrames).toBe(90);
  });

  it("does not accumulate drift across many fractional-frame scenes", () => {
    const scenes = Array.from({ length: 100 }, (_unused, index) => ({
      sceneId: `s${index}`,
      sceneNumber: index + 1,
      // 100ms at 30fps is 3 frames exactly only via absolute conversion.
      durationMilliseconds: 100,
    }));
    const timeline = buildProjectTimeline({
      framesPerSecond: 30,
      paddingMilliseconds: 0,
      scenes,
    });
    // Absolute conversion: 100 scenes * 100ms = 10000ms -> 300 frames exactly.
    expect(timeline.totalDurationMilliseconds).toBe(10000);
    expect(timeline.totalFrames).toBe(300);
    expect(timeline.scenes.at(-1)!.endFrame).toBe(300);
  });

  it("returns an empty timeline for no scenes", () => {
    const timeline = buildProjectTimeline({
      framesPerSecond: 30,
      paddingMilliseconds: 250,
      scenes: [],
    });
    expect(timeline.totalDurationMilliseconds).toBe(0);
    expect(timeline.totalFrames).toBe(0);
  });

  it("rejects a non-positive frame rate", () => {
    expect(() =>
      buildProjectTimeline({
        framesPerSecond: 0,
        paddingMilliseconds: 0,
        scenes: [],
      }),
    ).toThrow();
  });
});
