import { describe, expect, it } from "vitest";
import { validateInstagramReelAsset } from "@/lib/publishing/instagram-reel-validation";

const valid = {
  width: 1080,
  height: 1920,
  framesPerSecond: 30,
  durationMilliseconds: 60_000,
  sizeBytes: 50_000_000,
  contentType: "video/mp4",
};

describe("Instagram Reel validation", () => {
  it("accepts an exact vertical 9:16 MP4", () => {
    expect(validateInstagramReelAsset(valid)).toEqual({
      eligible: true,
      reason: null,
    });
  });

  it.each([
    [{ ...valid, width: 1920, height: 1080 }, "vertical 9:16"],
    [{ ...valid, framesPerSecond: 61 }, "23–60 FPS"],
    [{ ...valid, durationMilliseconds: 2000 }, "3 seconds"],
    [{ ...valid, sizeBytes: 1_073_741_825 }, "1 GB"],
    [{ ...valid, contentType: "video/webm" }, "MP4"],
  ])("rejects an incompatible asset", (asset, message) => {
    const result = validateInstagramReelAsset(asset);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain(message);
  });
});
