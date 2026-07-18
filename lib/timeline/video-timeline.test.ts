import { describe, expect, it } from "vitest";
import {
  buildVideoTimeline,
  type TimelineSceneAssetInput,
  type VideoRenderSettings,
} from "@/lib/timeline/video-timeline";

const RENDER: VideoRenderSettings = {
  width: 1920,
  height: 1080,
  framesPerSecond: 30,
  paddingMilliseconds: 250,
};

function scene(
  sceneNumber: number,
  durationMilliseconds: number,
  overrides: Partial<TimelineSceneAssetInput> = {},
): TimelineSceneAssetInput {
  return {
    sceneId: `scene-${sceneNumber}`,
    sceneNumber,
    sceneVersionId: `v${sceneNumber}`,
    sceneApproved: true,
    expectedDurationMilliseconds: durationMilliseconds,
    image: {
      generationId: `img-${sceneNumber}`,
      objectKey: `key/img-${sceneNumber}.webp`,
      width: 1536,
      height: 1024,
    },
    audio: {
      generationId: `aud-${sceneNumber}`,
      objectKey: `key/aud-${sceneNumber}.mp3`,
      durationMilliseconds,
      format: "mp3",
    },
    ...overrides,
  };
}

describe("buildVideoTimeline", () => {
  it("lays out approved scenes deterministically with padding", () => {
    const result = buildVideoTimeline({
      scenes: [scene(1, 2000), scene(2, 3000)],
      renderSettings: RENDER,
      durationMismatchToleranceMilliseconds: 1500,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const [first, second] = result.timeline.scenes;
    expect(first).toMatchObject({
      startMilliseconds: 0,
      endMilliseconds: 2000,
    });
    expect(second).toMatchObject({
      startMilliseconds: 2250,
      endMilliseconds: 5250,
    });
    expect(result.timeline.totalDurationMilliseconds).toBe(5250);
  });

  it("produces identical output for identical input", () => {
    const input = {
      scenes: [scene(1, 2000), scene(2, 3000)],
      renderSettings: RENDER,
      durationMismatchToleranceMilliseconds: 1500,
    };
    expect(buildVideoTimeline(input)).toEqual(buildVideoTimeline(input));
  });

  it("computes absolute frame counts without drift", () => {
    const result = buildVideoTimeline({
      scenes: [scene(1, 2000), scene(2, 3000)],
      renderSettings: RENDER,
      durationMismatchToleranceMilliseconds: 1500,
    });
    if (result.status !== "ready") throw new Error("expected ready");
    expect(result.timeline.scenes[0]!.startFrame).toBe(0);
    expect(result.timeline.scenes[0]!.endFrame).toBe(60);
    expect(result.timeline.scenes[0]!.durationFrames).toBe(60);
    // 5250ms * 30fps / 1000 = 157.5 -> 158 frames.
    expect(result.timeline.totalFrames).toBe(158);
  });

  it("rejects construction and reports every missing asset by scene", () => {
    const result = buildVideoTimeline({
      scenes: [
        scene(1, 2000, { image: null }),
        scene(2, 3000, { audio: null }),
        scene(3, 1000, { sceneApproved: false }),
      ],
      renderSettings: RENDER,
      durationMismatchToleranceMilliseconds: 1500,
    });
    expect(result.status).toBe("invalid");
    const codes = result.report.issues.map((issue) => issue.code);
    expect(codes).toContain("missingImage");
    expect(codes).toContain("missingAudio");
    expect(codes).toContain("sceneNotApproved");
    expect(result.report.errorCount).toBeGreaterThanOrEqual(3);
  });

  it("treats audio without a measured duration as a blocking error", () => {
    const result = buildVideoTimeline({
      scenes: [
        scene(1, 2000, {
          audio: {
            generationId: "aud-1",
            objectKey: "key/aud-1.mp3",
            durationMilliseconds: null,
            format: "mp3",
          },
        }),
      ],
      renderSettings: RENDER,
      durationMismatchToleranceMilliseconds: 1500,
    });
    expect(result.status).toBe("invalid");
    expect(result.report.issues.map((i) => i.code)).toContain(
      "missingAudioDuration",
    );
  });

  it("flags a duration mismatch as a non-blocking warning", () => {
    const result = buildVideoTimeline({
      scenes: [scene(1, 2000, { expectedDurationMilliseconds: 5000 })],
      renderSettings: RENDER,
      durationMismatchToleranceMilliseconds: 1500,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.report.warningCount).toBe(1);
    expect(result.report.issues[0]!.code).toBe("durationMismatch");
  });

  it("rejects an empty timeline", () => {
    const result = buildVideoTimeline({
      scenes: [],
      renderSettings: RENDER,
      durationMismatchToleranceMilliseconds: 1500,
    });
    expect(result.status).toBe("invalid");
    expect(result.report.issues[0]!.code).toBe("emptyTimeline");
  });

  it("attaches captions supplied per scene id", () => {
    const result = buildVideoTimeline({
      scenes: [scene(1, 2000)],
      renderSettings: RENDER,
      durationMismatchToleranceMilliseconds: 1500,
      captionsBySceneId: {
        "scene-1": [
          { text: "Hi", startMs: 0, endMs: 2000, startFrame: 0, endFrame: 60 },
        ],
      },
    });
    if (result.status !== "ready") throw new Error("expected ready");
    expect(result.timeline.captionCount).toBe(1);
    expect(result.timeline.scenes[0]!.captions[0]!.text).toBe("Hi");
  });
});
