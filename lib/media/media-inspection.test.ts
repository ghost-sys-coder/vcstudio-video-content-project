import { describe, expect, it } from "vitest";
import {
  analyzePcmQuality,
  evaluateUsableAudioDuration,
} from "@/lib/media/media-inspection";

function pcm(values: number[]): Buffer {
  const result = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => result.writeInt16LE(value, index * 2));
  return result;
}

describe("media inspection quality", () => {
  it("names severe silence without changing samples", () => {
    const result = analyzePcmQuality(pcm(new Array(100).fill(0)));
    expect(result.silenceRatio).toBe(1);
    expect(result.warnings[0]).toContain("mostly silent");
  });

  it("names severe clipping", () => {
    const result = analyzePcmQuality(pcm(new Array(100).fill(32_767)));
    expect(result.clippingRatio).toBe(1);
    expect(result.warnings[0]).toContain("severely clipped");
  });

  it("rejects unusable duration boundaries", () => {
    expect(evaluateUsableAudioDuration(499)).toContain("too short");
    expect(evaluateUsableAudioDuration(500)).toBeNull();
    expect(evaluateUsableAudioDuration(30 * 60 * 1000 + 1)).toContain(
      "30-minute",
    );
  });
});
