import { describe, expect, it } from "vitest";
import { assembleSubtitleTrack } from "@/lib/subtitles/subtitle-track";
import { findCueProblem } from "@/lib/subtitles/cue-editing";

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

const OPTIONS = {
  granularity: "sentence" as const,
  framesPerSecond: 30,
  maxLineCharacters: 42,
  minSegmentDurationMilliseconds: 400,
};

function scene(overrides: Record<string, unknown> = {}) {
  return {
    sceneId: "scene-1",
    sceneNumber: 1,
    sceneVersionId: "v1",
    narrationText: "The fund returned eight percent. Fees took most of it.",
    startMilliseconds: 0,
    endMilliseconds: 6000,
    ...overrides,
  };
}

describe("a scene with no measured audio", () => {
  it("keeps the proportional estimate, unchanged and unrelabelled", () => {
    const track = assembleSubtitleTrack([scene()], OPTIONS);
    expect(track.timingSource).toBe("estimated");
    for (const segment of track.segments)
      expect(segment.timingSource).toBe("estimated");
  });

  it("still covers the scene exactly end to end", () => {
    const track = assembleSubtitleTrack([scene()], OPTIONS);
    expect(track.segments[0]?.startMilliseconds).toBe(0);
    expect(track.segments[track.segments.length - 1]?.endMilliseconds).toBe(
      6000,
    );
  });
});

describe("a scene whose narration has a real pause", () => {
  it("moves the break onto the measured silence", () => {
    // The estimate puts the break near the middle; the narrator actually
    // pauses at 3.2s, which is where the caption should change.
    const withPause = assembleSubtitleTrack(
      [
        scene({
          audioEnvelope: envelope([
            { loud: true, milliseconds: 3200 },
            { loud: false, milliseconds: 400 },
            { loud: true, milliseconds: 2400 },
          ]),
          envelopeSampleRateHz: RATE,
        }),
      ],
      OPTIONS,
    );
    expect(withPause.timingSource).toBe("pause_adjusted");
    expect(withPause.segments[0]?.endMilliseconds).toBe(3400);
    expect(withPause.segments[1]?.startMilliseconds).toBe(3400);
  });

  it("reports estimated when the envelope offered nothing to move to", () => {
    // Claiming a pause adjustment that never happened is the failure this
    // guards: a silent envelope must not upgrade the label.
    const track = assembleSubtitleTrack(
      [
        scene({
          audioEnvelope: envelope([{ loud: true, milliseconds: 6000 }]),
          envelopeSampleRateHz: RATE,
        }),
      ],
      OPTIONS,
    );
    expect(track.timingSource).toBe("estimated");
  });

  it("leaves the track ordered and covering the scene after adjustment", () => {
    const track = assembleSubtitleTrack(
      [
        scene({
          audioEnvelope: envelope([
            { loud: true, milliseconds: 3200 },
            { loud: false, milliseconds: 400 },
            { loud: true, milliseconds: 2400 },
          ]),
          envelopeSampleRateHz: RATE,
        }),
      ],
      OPTIONS,
    );
    const relative = track.segments.map((segment) => ({
      text: segment.text,
      startMilliseconds: segment.startMilliseconds,
      endMilliseconds: segment.endMilliseconds,
    }));
    expect(
      findCueProblem(relative, {
        sceneDurationMilliseconds: 6000,
        minimumCueDurationMilliseconds: 400,
      }),
    ).toBeNull();
  });
});

describe("times a person set by hand", () => {
  const manualCues = [
    {
      text: "The fund returned 8%",
      startMilliseconds: 0,
      endMilliseconds: 2500,
    },
    {
      text: "Fees took most of it",
      startMilliseconds: 2600,
      endMilliseconds: 5800,
    },
  ];

  it("win outright over both the estimate and the pauses", () => {
    const track = assembleSubtitleTrack(
      [
        scene({
          manualCues,
          audioEnvelope: envelope([
            { loud: true, milliseconds: 3200 },
            { loud: false, milliseconds: 400 },
            { loud: true, milliseconds: 2400 },
          ]),
          envelopeSampleRateHz: RATE,
        }),
      ],
      OPTIONS,
    );
    expect(track.timingSource).toBe("manual");
    expect(track.segments.map((segment) => segment.text)).toEqual([
      "The fund returned 8%",
      "Fees took most of it",
    ]);
    expect(track.segments[1]?.endMilliseconds).toBe(5800);
  });

  it("are offset into the project timeline, not left relative to the scene", () => {
    const track = assembleSubtitleTrack(
      [
        scene({
          manualCues,
          startMilliseconds: 10_000,
          endMilliseconds: 16_000,
        }),
      ],
      OPTIONS,
    );
    expect(track.segments[0]?.startMilliseconds).toBe(10_000);
    expect(track.segments[1]?.endMilliseconds).toBe(15_800);
  });

  it("are not overwritten by the settings-level text override", () => {
    // The override edited the derived line; the hand-set cue already carries
    // the corrected words, and re-applying would undo the correction.
    const track = assembleSubtitleTrack([scene({ manualCues })], {
      ...OPTIONS,
      textOverrides: { "v1:0": "Something else entirely" },
    });
    expect(track.segments[0]?.text).toBe("The fund returned 8%");
  });
});

describe("a track whose scenes disagree", () => {
  it("reports the weakest source across the whole track", () => {
    const track = assembleSubtitleTrack(
      [
        scene({
          sceneId: "scene-1",
          sceneNumber: 1,
          sceneVersionId: "v1",
          manualCues: [
            {
              text: "Set by hand",
              startMilliseconds: 0,
              endMilliseconds: 5000,
            },
          ],
        }),
        scene({
          sceneId: "scene-2",
          sceneNumber: 2,
          sceneVersionId: "v2",
          startMilliseconds: 6000,
          endMilliseconds: 12_000,
        }),
      ],
      OPTIONS,
    );
    expect(track.timingSource).toBe("estimated");
    expect(track.segments[0]?.timingSource).toBe("manual");
  });
});
