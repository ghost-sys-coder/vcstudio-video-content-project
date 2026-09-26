import { describe, expect, it } from "vitest";
import {
  isWorthTrimming,
  measureSceneSilence,
  MINIMUM_REPORTABLE_SAVING_MILLISECONDS,
  SILENCE_BREATH_MILLISECONDS,
  summariseSceneSilence,
  type SceneSilenceRow,
} from "@/lib/audio/scene-silence";

const SAMPLE_RATE_HZ = 50;
const MS_PER_SAMPLE = 1_000 / SAMPLE_RATE_HZ;

/** Builds an envelope: quiet head, loud body, quiet tail, in milliseconds. */
function envelope(head: number, body: number, tail: number): number[] {
  const samples = (ms: number) => Math.round(ms / MS_PER_SAMPLE);
  return [
    ...Array<number>(samples(head)).fill(2),
    ...Array<number>(samples(body)).fill(80),
    ...Array<number>(samples(tail)).fill(2),
  ];
}

function measure(head: number, body: number, tail: number) {
  return measureSceneSilence({
    envelope: envelope(head, body, tail),
    sampleRateHz: SAMPLE_RATE_HZ,
    durationMilliseconds: head + body + tail,
  });
}

describe("measureSceneSilence", () => {
  it("finds dead air at both ends", () => {
    const result = measure(1_000, 4_000, 1_500);
    expect(result.measured).toBe(true);
    expect(result.leadingMilliseconds).toBeGreaterThan(0);
    expect(result.trailingMilliseconds).toBeGreaterThan(0);
  });

  // Cutting to the first loud sample sounds clipped, and the breath before a
  // line is part of how the line reads.
  it("leaves a breath rather than cutting to the first word", () => {
    const result = measure(1_000, 4_000, 0);
    expect(result.leadingMilliseconds).toBeLessThanOrEqual(
      1_000 - SILENCE_BREATH_MILLISECONDS,
    );
    expect(result.leadingMilliseconds).toBeGreaterThan(0);
  });

  it("shortens the scene by exactly what it removes", () => {
    const result = measure(800, 5_000, 900);
    expect(result.trimmedDurationMilliseconds).toBe(
      800 + 5_000 + 900 - result.savedMilliseconds,
    );
  });

  it("reports nothing to save for a clip that starts and ends on speech", () => {
    const result = measure(0, 5_000, 0);
    expect(result.savedMilliseconds).toBe(0);
    expect(result.trimmedDurationMilliseconds).toBe(5_000);
  });

  // Guessing silence from a duration alone would be fabrication, and clips
  // recorded before the envelope existed carry none.
  it("measures nothing without an envelope, rather than guessing", () => {
    const result = measureSceneSilence({
      envelope: null,
      sampleRateHz: SAMPLE_RATE_HZ,
      durationMilliseconds: 6_000,
    });
    expect(result.measured).toBe(false);
    expect(result.savedMilliseconds).toBe(0);
    expect(result.trimmedDurationMilliseconds).toBe(6_000);
  });

  it("measures nothing without a sample rate", () => {
    expect(
      measureSceneSilence({
        envelope: envelope(500, 2_000, 500),
        sampleRateHz: 0,
        durationMilliseconds: 3_000,
      }).measured,
    ).toBe(false);
  });

  // Whatever is wrong with a clip that is silence end to end, a zero-length
  // scene is not the fix.
  it("refuses to trim a clip away to nothing", () => {
    const silent = Array<number>(100).fill(1);
    const result = measureSceneSilence({
      envelope: silent,
      sampleRateHz: SAMPLE_RATE_HZ,
      durationMilliseconds: 2_000,
    });
    expect(result.trimmedDurationMilliseconds).toBeGreaterThan(0);
    expect(result.savedMilliseconds).toBe(0);
  });

  it("handles a zero or nonsense duration without producing a negative", () => {
    for (const duration of [0, -50, Number.NaN]) {
      const result = measureSceneSilence({
        envelope: envelope(200, 400, 200),
        sampleRateHz: SAMPLE_RATE_HZ,
        durationMilliseconds: duration,
      });
      expect(result.trimmedDurationMilliseconds).toBeGreaterThanOrEqual(0);
      expect(result.savedMilliseconds).toBe(0);
    }
  });
});

describe("isWorthTrimming", () => {
  it("ignores a saving too small to see in the finished video", () => {
    expect(isWorthTrimming(measure(150, 5_000, 0))).toBe(false);
  });

  it("offers a saving worth acting on", () => {
    expect(isWorthTrimming(measure(1_200, 5_000, 1_200))).toBe(true);
  });

  it("never offers a trim it could not measure", () => {
    expect(
      isWorthTrimming(
        measureSceneSilence({
          envelope: null,
          sampleRateHz: null,
          durationMilliseconds: 9_000,
        }),
      ),
    ).toBe(false);
  });
});

describe("summariseSceneSilence", () => {
  function row(sceneNumber: number, head: number, body: number, tail: number) {
    return {
      sceneId: `scene-${sceneNumber}`,
      sceneNumber,
      durationMilliseconds: head + body + tail,
      silence: measure(head, body, tail),
    } satisfies SceneSilenceRow;
  }

  it("adds up what the whole video would save", () => {
    const summary = summariseSceneSilence([
      row(1, 1_000, 4_000, 1_000),
      row(2, 1_000, 4_000, 1_000),
    ]);
    expect(summary.trimmableSceneCount).toBe(2);
    expect(summary.totalSavedMilliseconds).toBeGreaterThan(0);
    expect(summary.trimmedDurationMilliseconds).toBe(
      summary.currentDurationMilliseconds - summary.totalSavedMilliseconds,
    );
  });

  // The headline figure has to match the scenes actually listed, or it promises
  // a saving the interface never shows anyone how to take.
  it("counts only the scenes it would offer", () => {
    const summary = summariseSceneSilence([
      row(1, 1_500, 4_000, 1_500),
      row(2, 100, 4_000, 0),
    ]);
    expect(summary.trimmableSceneCount).toBe(1);
    expect(summary.totalSavedMilliseconds).toBe(
      measure(1_500, 4_000, 1_500).savedMilliseconds,
    );
  });

  it("counts scenes it could not measure separately from scenes with no silence", () => {
    const summary = summariseSceneSilence([
      {
        sceneId: "a",
        sceneNumber: 1,
        durationMilliseconds: 5_000,
        silence: measureSceneSilence({
          envelope: null,
          sampleRateHz: null,
          durationMilliseconds: 5_000,
        }),
      },
      row(2, 0, 5_000, 0),
    ]);
    expect(summary.unmeasuredSceneCount).toBe(1);
    expect(summary.trimmableSceneCount).toBe(0);
  });

  it("reports an empty project as nothing to do", () => {
    const summary = summariseSceneSilence([]);
    expect(summary.totalSavedMilliseconds).toBe(0);
    expect(summary.currentDurationMilliseconds).toBe(0);
    expect(summary.trimmableSceneCount).toBe(0);
  });

  it("never claims a saving below the reportable floor", () => {
    const summary = summariseSceneSilence([row(1, 100, 5_000, 100)]);
    expect(summary.totalSavedMilliseconds).toBeLessThan(
      MINIMUM_REPORTABLE_SAVING_MILLISECONDS,
    );
  });
});
