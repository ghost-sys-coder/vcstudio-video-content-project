import { describe, expect, it } from "vitest";
import { validateTikTokUploadAsset } from "@/lib/publishing/tiktok-upload-validation";

const valid = {
  width: 1080,
  height: 1920,
  framesPerSecond: 30,
  durationMilliseconds: 60_000,
  sizeBytes: 50_000_000,
  contentType: "video/mp4",
};

describe("TikTok upload validation", () => {
  it("accepts a compatible MP4 render", () => {
    expect(validateTikTokUploadAsset(valid)).toEqual({
      eligible: true,
      reason: null,
    });
  });

  it.each([
    [{ ...valid, width: 359 }, "360"],
    [{ ...valid, height: 4097 }, "4096"],
    [{ ...valid, framesPerSecond: 61 }, "23–60 FPS"],
    [{ ...valid, durationMilliseconds: 600_001 }, "10 minutes"],
    [{ ...valid, sizeBytes: 4_294_967_297 }, "4 GB"],
    [{ ...valid, contentType: "video/webm" }, "MP4"],
  ])("rejects an incompatible render", (asset, reason) => {
    const result = validateTikTokUploadAsset(asset);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain(reason);
  });
});
