import { describe, expect, it } from "vitest";
import {
  assembleSubtitleTrack,
  type SubtitleTrackOptions,
  type SubtitleTrackSceneInput,
} from "@/lib/subtitles/subtitle-track";

const BASE_OPTIONS: SubtitleTrackOptions = {
  granularity: "sentence",
  framesPerSecond: 30,
  maxLineCharacters: 42,
  minSegmentDurationMilliseconds: 500,
};

const TWO_SCENES: SubtitleTrackSceneInput[] = [
  {
    sceneId: "scene-1",
    sceneNumber: 1,
    sceneVersionId: "v1",
    narrationText: "One two three. Four five six.",
    startMilliseconds: 0,
    endMilliseconds: 4000,
  },
  {
    sceneId: "scene-2",
    sceneNumber: 2,
    sceneVersionId: "v2",
    narrationText: "Seven eight.",
    startMilliseconds: 4250,
    endMilliseconds: 6250,
  },
];

describe("assembleSubtitleTrack", () => {
  it("distributes a scene duration proportionally across sentences", () => {
    const track = assembleSubtitleTrack(TWO_SCENES, BASE_OPTIONS);
    const scene1 = track.segments.filter((s) => s.sceneId === "scene-1");
    expect(scene1).toHaveLength(2);
    expect(scene1[0]).toMatchObject({
      startMilliseconds: 0,
      endMilliseconds: 2000,
    });
    expect(scene1[1]).toMatchObject({
      startMilliseconds: 2000,
      endMilliseconds: 4000,
    });
    // The final segment always ends exactly on the scene boundary.
    expect(scene1[1]!.endMilliseconds).toBe(4000);
  });

  it("never produces overlapping segments", () => {
    const track = assembleSubtitleTrack(TWO_SCENES, BASE_OPTIONS);
    for (let index = 1; index < track.segments.length; index += 1) {
      expect(track.segments[index]!.startMilliseconds).toBeGreaterThanOrEqual(
        track.segments[index - 1]!.endMilliseconds,
      );
    }
  });

  it("is deterministic for identical input", () => {
    const first = assembleSubtitleTrack(TWO_SCENES, BASE_OPTIONS);
    const second = assembleSubtitleTrack(TWO_SCENES, BASE_OPTIONS);
    expect(first).toEqual(second);
  });

  it("computes absolute frames from absolute milliseconds", () => {
    const track = assembleSubtitleTrack(TWO_SCENES, BASE_OPTIONS);
    const scene1 = track.segments.filter((s) => s.sceneId === "scene-1");
    expect(scene1[0]!.startFrame).toBe(0);
    expect(scene1[0]!.endFrame).toBe(60);
    expect(scene1[1]!.endFrame).toBe(120);
  });

  it("emits one segment per scene at scene granularity", () => {
    const track = assembleSubtitleTrack(TWO_SCENES, {
      ...BASE_OPTIONS,
      granularity: "scene",
    });
    const scene1 = track.segments.filter((s) => s.sceneId === "scene-1");
    expect(scene1).toHaveLength(1);
    expect(scene1[0]!.text).toBe("One two three. Four five six.");
  });

  it("merges a segment shorter than the minimum duration", () => {
    const track = assembleSubtitleTrack(
      [
        {
          sceneId: "scene-1",
          sceneNumber: 1,
          sceneVersionId: "v1",
          narrationText: "Hi. This is a much longer sentence here.",
          startMilliseconds: 0,
          endMilliseconds: 3000,
        },
      ],
      BASE_OPTIONS,
    );
    expect(track.segments).toHaveLength(1);
    expect(track.segments[0]!.text.startsWith("Hi. This is")).toBe(true);
    expect(track.segments[0]!.endMilliseconds).toBe(3000);
  });

  it("applies a non-empty text override, keyed by scene version and index", () => {
    const track = assembleSubtitleTrack(TWO_SCENES, {
      ...BASE_OPTIONS,
      textOverrides: { "v1:0": "Custom caption" },
    });
    const first = track.segments.find((s) => s.key === "v1:0");
    expect(first?.text).toBe("Custom caption");
  });

  it("skips scenes with no duration and no narration", () => {
    const track = assembleSubtitleTrack(
      [
        {
          sceneId: "empty",
          sceneNumber: 1,
          sceneVersionId: "v1",
          narrationText: "",
          startMilliseconds: 0,
          endMilliseconds: 0,
        },
      ],
      BASE_OPTIONS,
    );
    expect(track.segments).toHaveLength(0);
    expect(track.totalDurationMilliseconds).toBe(0);
  });
});
