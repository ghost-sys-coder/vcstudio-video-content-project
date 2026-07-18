import { describe, expect, it } from "vitest";
import { formatWebVtt } from "@/lib/subtitles/subtitle-webvtt";
import type { SubtitleTrack } from "@/lib/subtitles/subtitle-track";

const TRACK: SubtitleTrack = {
  granularity: "sentence",
  framesPerSecond: 30,
  totalDurationMilliseconds: 4500,
  segments: [
    {
      sceneId: "scene-1",
      sceneNumber: 1,
      sceneVersionId: "v1",
      index: 0,
      key: "v1:0",
      text: "Hello world",
      startMilliseconds: 0,
      endMilliseconds: 2000,
      startFrame: 0,
      endFrame: 60,
    },
    {
      sceneId: "scene-2",
      sceneNumber: 2,
      sceneVersionId: "v2",
      index: 0,
      key: "v2:0",
      text: "Second caption line",
      startMilliseconds: 2000,
      endMilliseconds: 4500,
      startFrame: 60,
      endFrame: 135,
    },
  ],
};

describe("formatWebVtt", () => {
  it("begins with the WEBVTT header and uses period-separated timestamps", () => {
    expect(formatWebVtt(TRACK, { maxLineCharacters: 42 })).toBe(
      [
        "WEBVTT",
        "",
        "1",
        "00:00:00.000 --> 00:00:02.000",
        "Hello world",
        "",
        "2",
        "00:00:02.000 --> 00:00:04.500",
        "Second caption line",
        "",
      ].join("\n"),
    );
  });

  it("returns just the header for an empty track", () => {
    expect(
      formatWebVtt(
        { ...TRACK, segments: [], totalDurationMilliseconds: 0 },
        { maxLineCharacters: 42 },
      ),
    ).toBe("WEBVTT\n");
  });
});
