import { describe, expect, it } from "vitest";
import { checkVerifiedVideoCompatibility } from "@/lib/social/video-platform-compatibility";

const video = {
  kind: "video" as const,
  durationMilliseconds: 5_000,
  container: "mp4",
  codec: "h264",
  width: 1920,
  height: 1080,
  displayWidth: 1920,
  displayHeight: 1080,
  rotationDegrees: 0,
  averageFrameRate: 29.97,
  variableFrameRate: false,
  hasAudio: true,
  audioCodec: "aac",
};

describe("verified video compatibility", () => {
  it("requires authoritative inspection", () => {
    expect(
      checkVerifiedVideoCompatibility({
        platform: "instagram",
        metadata: null,
      }),
    ).toMatchObject({ compatible: false });
  });

  it("names the H.264 remediation for strict destinations", () => {
    expect(
      checkVerifiedVideoCompatibility({
        platform: "tiktok",
        metadata: { ...video, codec: "vp9" },
      }),
    ).toMatchObject({
      compatible: false,
      reason: expect.stringContaining("H.264"),
    });
  });

  it("accepts an inspected compatible video", () => {
    expect(
      checkVerifiedVideoCompatibility({
        platform: "instagram",
        metadata: video,
      }),
    ).toEqual({ compatible: true });
  });
});
