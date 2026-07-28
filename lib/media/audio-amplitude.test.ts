import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { computeAmplitudeEnvelopeFromPcm } from "@/lib/media/audio-amplitude";

function pcmFromSamples(samples: number[]): Buffer {
  const buffer = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => buffer.writeInt16LE(sample, index * 2));
  return buffer;
}

describe("computeAmplitudeEnvelopeFromPcm", () => {
  it("peak-normalizes each frame window against the loudest sample in the clip", () => {
    // sampleRate=4, framesPerSecond=1 -> 4 samples per frame window.
    const pcm = pcmFromSamples([0, 0, 0, 0, 8000, -16000, 0, 0]);
    const envelope = computeAmplitudeEnvelopeFromPcm({
      pcm,
      sampleRate: 4,
      frameCount: 2,
      framesPerSecond: 1,
    });
    expect(envelope).toEqual([0, 1]);
  });

  it("returns an all-zero envelope for silent audio instead of dividing by zero", () => {
    const pcm = pcmFromSamples([0, 0, 0, 0, 0, 0, 0, 0]);
    const envelope = computeAmplitudeEnvelopeFromPcm({
      pcm,
      sampleRate: 4,
      frameCount: 2,
      framesPerSecond: 1,
    });
    expect(envelope).toEqual([0, 0]);
  });

  it("treats a frame window past the end of the decoded samples as silent", () => {
    // Only 4 samples decoded (1 second at sampleRate=4), but 2 frames requested.
    const pcm = pcmFromSamples([16000, -16000, 8000, -8000]);
    const envelope = computeAmplitudeEnvelopeFromPcm({
      pcm,
      sampleRate: 4,
      frameCount: 2,
      framesPerSecond: 1,
    });
    expect(envelope).toEqual([1, 0]);
  });
});
