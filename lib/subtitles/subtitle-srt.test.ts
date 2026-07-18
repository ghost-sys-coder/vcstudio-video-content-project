import { describe, expect, it } from "vitest";
import { formatSrt } from "@/lib/subtitles/subtitle-srt";
import type { SubtitleTrack } from "@/lib/subtitles/subtitle-track";

function segment(
  index: number,
  text: string,
  startMilliseconds: number,
  endMilliseconds: number,
) {
  return {
    sceneId: `scene-${index}`,
    sceneNumber: index + 1,
    sceneVersionId: "v1",
    index,
    key: `v1:${index}`,
    text,
    startMilliseconds,
    endMilliseconds,
    startFrame: 0,
    endFrame: 0,
  };
}

const TRACK: SubtitleTrack = {
  granularity: "sentence",
  framesPerSecond: 30,
  totalDurationMilliseconds: 4500,
  segments: [
    segment(0, "Hello world", 0, 2000),
    segment(1, "Second caption line", 2000, 4500),
  ],
};

describe("formatSrt", () => {
  it("numbers cues from one with comma-separated timestamps", () => {
    expect(formatSrt(TRACK, { maxLineCharacters: 42 })).toBe(
      [
        "1",
        "00:00:00,000 --> 00:00:02,000",
        "Hello world",
        "",
        "2",
        "00:00:02,000 --> 00:00:04,500",
        "Second caption line",
        "",
      ].join("\n"),
    );
  });

  it("wraps long caption text to the configured line length", () => {
    const output = formatSrt(TRACK, { maxLineCharacters: 8 });
    expect(output).toContain("Second\ncaption\nline");
  });

  it("returns an empty string for an empty track", () => {
    expect(
      formatSrt(
        { ...TRACK, segments: [], totalDurationMilliseconds: 0 },
        { maxLineCharacters: 42 },
      ),
    ).toBe("");
  });
});
