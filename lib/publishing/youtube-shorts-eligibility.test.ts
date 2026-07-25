import { describe, expect, it } from "vitest";
import { evaluateYouTubeShortsEligibility } from "@/lib/publishing/youtube-shorts-eligibility";

const valid = {
  width: 1080,
  height: 1920,
  durationMilliseconds: 60_000,
};

describe("YouTube Shorts eligibility", () => {
  it("accepts a vertical render under 3 minutes", () => {
    expect(evaluateYouTubeShortsEligibility(valid)).toEqual({
      eligible: true,
      reason: null,
    });
  });

  it("accepts a square render", () => {
    expect(
      evaluateYouTubeShortsEligibility({ ...valid, width: 1080, height: 1080 }),
    ).toEqual({ eligible: true, reason: null });
  });

  it("accepts exactly 3 minutes", () => {
    expect(
      evaluateYouTubeShortsEligibility({
        ...valid,
        durationMilliseconds: 180_000,
      }),
    ).toEqual({ eligible: true, reason: null });
  });

  it.each([
    [{ ...valid, width: 1920, height: 1080 }, "vertical or square"],
    [{ ...valid, durationMilliseconds: 180_001 }, "3 minutes"],
  ])("rejects an incompatible asset", (asset, message) => {
    const result = evaluateYouTubeShortsEligibility(asset);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain(message);
  });
});
