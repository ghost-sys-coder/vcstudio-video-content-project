import { describe, expect, it } from "vitest";
import { createProductionBaselineFixture } from "@/lib/test-utils/version-two-production-fixture";
import { buildShortTimeline } from "@/lib/shorts/short-timeline";
import { buildVideoTimeline } from "@/lib/timeline/video-timeline";
import { buildRenderTimelineSnapshot } from "@/lib/render/build-render-snapshot";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";

describe("V2-00 synthetic production baseline", () => {
  it("assembles 40 approved scenes with captions, framing, and drift-free timing", () => {
    const { timeline } = createProductionBaselineFixture();
    expect(timeline.scenes).toHaveLength(40);
    expect(timeline.totalDurationMilliseconds).toBe(489_750);
    expect(timeline.totalFrames).toBe(14_693);
    expect(timeline.scenes[2]?.image.framing?.focalPointXBps).toBe(6500);
    expect(timeline.scenes[2]?.captions[0]?.text).toBe(
      "An edited fixture caption.",
    );
    for (const scene of timeline.scenes) {
      expect(scene.captions.length).toBeGreaterThan(0);
      for (const cue of scene.captions) {
        expect(cue.startMs).toBeGreaterThanOrEqual(scene.startMilliseconds);
        expect(cue.endMs).toBeLessThanOrEqual(scene.endMilliseconds);
      }
    }
  });

  it("derives a 45-second Short using existing media and reports crossed caption boundaries", () => {
    const fixture = createProductionBaselineFixture();
    const { timeline, warnings } = buildShortTimeline({
      source: fixture.timeline,
      clips: fixture.clips,
      width: 1080,
      height: 1920,
    });
    expect(timeline.totalDurationMilliseconds).toBe(45_000);
    expect(timeline.totalFrames).toBe(1350);
    expect(timeline.scenes).toHaveLength(4);
    expect(timeline.scenes.map((scene) => scene.audio.objectKey)).toEqual(
      fixture.timeline.scenes.slice(2, 6).map((scene) => scene.audio.objectKey),
    );
    expect(timeline.scenes[0]?.captions[0]?.text).toBe(
      "An edited fixture caption.",
    );
    expect(
      warnings.some((warning) => warning.code === "captionBoundaryCut"),
    ).toBe(true);
  });

  it("identifies individual missing image and audio blockers in a partially failed batch", () => {
    const { timelineInput } = createProductionBaselineFixture();
    timelineInput.scenes[6]!.image = null;
    timelineInput.scenes[10]!.audio = null;
    const result = buildVideoTimeline(timelineInput);
    expect(result.status).toBe("invalid");
    expect(
      result.report.issues.map(({ sceneNumber, code }) => ({
        sceneNumber,
        code,
      })),
    ).toEqual([
      { sceneNumber: 7, code: "missingImage" },
      { sceneNumber: 11, code: "missingAudio" },
    ]);
  });

  it("keeps a serialized historical render independent of subsequent source edits", () => {
    const fixture = createProductionBaselineFixture();
    const snapshot = buildRenderTimelineSnapshot({
      timeline: fixture.timeline,
      captionStyle: DEFAULT_CAPTION_STYLE,
      includeCaptions: true,
      includeWatermark: false,
    });
    const persisted = JSON.stringify(snapshot);
    fixture.timeline.scenes[2]!.captions[0]!.text = "A later edit.";
    fixture.timeline.scenes[2]!.audio.objectKey = "a-later-recording.mp3";
    expect(JSON.stringify(snapshot)).toBe(persisted);
    expect(persisted).not.toContain("https://");
  });
});
