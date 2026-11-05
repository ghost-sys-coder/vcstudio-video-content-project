import { describe, it, expect } from "vitest";
import { VIDEO_PRICES } from "./video-model-catalog";
import { measuredVideoCost } from "./video-cost";
describe("actual Google video token accounting", () => {
  it("accounts for input, generated video, text and separate thinking tokens", () => {
    expect(
      measuredVideoCost(VIDEO_PRICES[0]!, {
        inputTokens: 1000,
        outputTokens: 58020,
        videoTokens: 57920,
        thoughtTokens: 200,
      }),
    ).toBe(102);
  });
  it("retains reservations when actual token accounting is incomplete", () => {
    expect(
      measuredVideoCost(VIDEO_PRICES[0]!, {
        inputTokens: 1,
        outputTokens: 100,
        videoTokens: 99,
        thoughtTokens: 0,
        unknownOutputTokens: 1,
      }),
    ).toBeNull();
    expect(measuredVideoCost(VIDEO_PRICES[0]!, null)).toBeNull();
    expect(
      measuredVideoCost(VIDEO_PRICES[0]!, {
        inputTokens: 1,
        outputTokens: 10,
        videoTokens: 0,
        thoughtTokens: 0,
      }),
    ).toBeNull();
    expect(
      measuredVideoCost(VIDEO_PRICES[1]!, {
        inputTokens: 1,
        outputTokens: 10,
        videoTokens: 10,
        thoughtTokens: 0,
      }),
    ).toBeNull();
  });
});
