import { describe, expect, it } from "vitest";

import { resampleAmplitudeEnvelope } from "@/lib/media/amplitude-envelope";

describe("resampleAmplitudeEnvelope", () => {
  it("maps a stored envelope onto frames and rescales to 0..1", () => {
    // 2 Hz envelope, 4 fps -> each stored sample covers two frames.
    expect(
      resampleAmplitudeEnvelope({
        envelope: [100, 0],
        envelopeSampleRateHz: 2,
        frameCount: 4,
        framesPerSecond: 4,
      }),
    ).toEqual([1, 1, 0, 0]);
  });

  it("is independent of the project frame rate", () => {
    // The same stored envelope must describe the same moment in time whether
    // the project renders at 30 or 60 fps — that is the whole reason the stored
    // form is fixed-rate rather than frame-indexed.
    const envelope = [0, 100];
    const at30 = resampleAmplitudeEnvelope({
      envelope,
      envelopeSampleRateHz: 1,
      frameCount: 60,
      framesPerSecond: 30,
    });
    const at60 = resampleAmplitudeEnvelope({
      envelope,
      envelopeSampleRateHz: 1,
      frameCount: 120,
      framesPerSecond: 60,
    });
    expect(at30[0]).toBe(0);
    expect(at30[30]).toBe(1);
    expect(at60[0]).toBe(0);
    expect(at60[60]).toBe(1);
  });

  it("pads frames past the end of a short envelope with silence", () => {
    expect(
      resampleAmplitudeEnvelope({
        envelope: [100],
        envelopeSampleRateHz: 1,
        frameCount: 3,
        framesPerSecond: 1,
      }),
    ).toEqual([1, 0, 0]);
  });

  it("returns silence rather than throwing for an empty envelope", () => {
    expect(
      resampleAmplitudeEnvelope({
        envelope: [],
        envelopeSampleRateHz: 50,
        frameCount: 3,
        framesPerSecond: 30,
      }),
    ).toEqual([0, 0, 0]);
    expect(
      resampleAmplitudeEnvelope({
        envelope: [100],
        envelopeSampleRateHz: 50,
        frameCount: 0,
        framesPerSecond: 30,
      }),
    ).toEqual([]);
  });
});
