import { describe, expect, it } from "vitest";
import { describeCaptionReview } from "@/lib/render/caption-review-summary";

const ready = {
  captionCount: 42,
  timelineStatus: "ready" as const,
  captionsEnabled: true,
};

describe("describeCaptionReview", () => {
  it("states the cue count when captions are ready to read", () => {
    const summary = describeCaptionReview(ready);
    expect(summary.tone).toBe("ready");
    expect(summary.headline).toContain("42");
  });

  it("never claims captions will appear in the render", () => {
    // Burning captions in is a per-render choice, so assembly must not read as
    // a promise that the output will carry them.
    for (const summary of [
      describeCaptionReview(ready),
      describeCaptionReview({ ...ready, captionCount: 0 }),
      describeCaptionReview({ ...ready, timelineStatus: "invalid" }),
      describeCaptionReview({ ...ready, captionsEnabled: false }),
    ]) {
      const text = `${summary.headline} ${summary.detail}`;
      expect(text).not.toMatch(/will (be|appear)/i);
      expect(text).not.toMatch(/burned in\b(?! stays)/i);
    }
  });

  it("says captions are missing rather than ready when there are none", () => {
    const summary = describeCaptionReview({ ...ready, captionCount: 0 });
    expect(summary.tone).toBe("missing");
    expect(summary.headline).toBe("No captions yet");
  });

  it("does not call cues ready while the timeline still blocks a render", () => {
    // Cues that exist against an invalid timeline are not reviewable evidence
    // of what will render, so they must not read as finished work.
    const summary = describeCaptionReview({
      ...ready,
      timelineStatus: "invalid",
    });
    expect(summary.tone).toBe("unreviewed");
    expect(summary.headline).toContain("not ready");
  });

  it("explains a disabled subtitle configuration instead of blaming the creator", () => {
    const summary = describeCaptionReview({ ...ready, captionsEnabled: false });
    expect(summary.tone).toBe("missing");
    expect(summary.detail).toContain("server configuration");
  });

  it("always offers a way into the captions view", () => {
    for (const input of [
      ready,
      { ...ready, captionCount: 0 },
      { ...ready, captionsEnabled: false },
    ])
      expect(describeCaptionReview(input).actionLabel.length).toBeGreaterThan(
        0,
      );
  });
});
