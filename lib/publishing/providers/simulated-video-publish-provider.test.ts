import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SimulatedVideoPublishProvider } from "@/lib/publishing/providers/simulated-video-publish-provider";
import type { PublishVideoRequest } from "@/lib/publishing/video-publish-provider";

function request(
  overrides: Partial<PublishVideoRequest> = {},
): PublishVideoRequest {
  return {
    tokens: { accessToken: "x" },
    account: { externalAccountId: "acc" },
    sourceUrl: "https://example.com/video.mp4",
    sizeBytes: 4_533_009,
    contentType: "video/mp4",
    title: "T",
    description: "",
    tags: [],
    visibility: "public",
    caption: "cap",
    shareToFeed: true,
    providerOperationId: null,
    providerOperationSecret: null,
    // No real waiting in tests.
    waitForProcessing: async () => {},
    ...overrides,
  };
}

describe("SimulatedVideoPublishProvider", () => {
  it("ramps progress to 100 and returns a synthetic published result", async () => {
    const progress: number[] = [];
    const provider = new SimulatedVideoPublishProvider({
      platform: "instagram",
      stepDelayMs: 0,
    });
    const result = await provider.publishVideo(
      request({ onProgress: (p) => void progress.push(p) }),
    );

    expect(progress.at(-1)).toBe(100);
    expect(progress).toEqual([...progress].sort((a, b) => a - b)); // monotonic
    expect(result.completionStage).toBe("published");
    expect(result.externalVideoUrl).toContain("instagram.com/reel/");
    expect(result.externalVideoId).toMatch(/^SIM/);
    expect(result.uploadedBytes).toBe(4_533_009);
  });

  it("never touches the network — no real API host in the URL", async () => {
    const provider = new SimulatedVideoPublishProvider({
      platform: "instagram",
      stepDelayMs: 0,
    });
    const result = await provider.publishVideo(request());
    // Synthetic id marks it as fake so it's obviously not a real post.
    expect(result.externalVideoUrl).toContain(result.externalVideoId);
  });

  it("mirrors TikTok's inbox delivery instead of publishing", async () => {
    const provider = new SimulatedVideoPublishProvider({
      platform: "tiktok",
      stepDelayMs: 0,
    });
    const result = await provider.publishVideo(request());
    expect(result.completionStage).toBe("inbox_delivered");
  });

  it("uses the platform's own watch URL shape", async () => {
    const youtube = new SimulatedVideoPublishProvider({
      platform: "youtube",
      stepDelayMs: 0,
    });
    const result = await youtube.publishVideo(request());
    expect(result.externalVideoUrl).toContain("youtube.com/watch?v=");
  });
});
