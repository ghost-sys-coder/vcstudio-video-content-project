import { describe, it, expect } from "vitest";
import {
  buildVideoTimeline,
  type TimelineSceneAssetInput,
  type TimelineVideoAsset,
} from "@/lib/timeline/video-timeline";
import { buildRenderTimelineSnapshot } from "./build-render-snapshot";
import {
  buildVideoCompositionInput,
  parseVideoCompositionInput,
} from "./render-composition-input";
import { collectRenderAssetObjectKeys } from "./render-asset-keys";
import { buildPreviewAssets } from "./preview-preload-plan";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";
import { buildShortTimeline } from "@/lib/shorts/short-timeline";
const sceneId = "11111111-1111-4111-8111-111111111111",
  versionId = "22222222-2222-4222-8222-222222222222",
  otherId = "33333333-3333-4333-8333-333333333333",
  selectionId = "44444444-4444-4444-8444-444444444444";
const video: TimelineVideoAsset = {
  selectionId,
  objectKey: "project-owned/clip.mp4",
  width: 1280,
  height: 720,
  durationMilliseconds: 4000,
  trimStartMilliseconds: 500,
  loop: false,
  fit: "contain",
  approved: true,
};
function scene(
  overrides: Partial<TimelineSceneAssetInput> = {},
): TimelineSceneAssetInput {
  return {
    sceneId,
    sceneVersionId: versionId,
    sceneNumber: 1,
    sceneApproved: true,
    expectedDurationMilliseconds: 3000,
    image: {
      generationId: "image",
      objectKey: "still.png",
      width: 1536,
      height: 1024,
    },
    audio: {
      generationId: "audio",
      objectKey: "narration.mp3",
      durationMilliseconds: 3000,
      format: "mp3",
    },
    ...overrides,
  };
}
function timeline(scenes: TimelineSceneAssetInput[]) {
  return buildVideoTimeline({
    scenes,
    renderSettings: {
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      paddingMilliseconds: 250,
    },
    durationMismatchToleranceMilliseconds: 1000,
  });
}
function snapshot(scenes: TimelineSceneAssetInput[]) {
  const result = timeline(scenes);
  if (result.status !== "ready") throw new Error(JSON.stringify(result.report));
  return buildRenderTimelineSnapshot({
    timeline: result.timeline,
    captionStyle: DEFAULT_CAPTION_STYLE,
    includeCaptions: true,
    includeWatermark: false,
  });
}
describe("mixed still/video timeline, preview and render contract", () => {
  it("renders video without requiring a still and signs every exact asset", () => {
    const frozen = snapshot([
      scene(),
      scene({
        sceneId: otherId,
        sceneNumber: 2,
        visualKind: "video",
        image: null,
        video,
      }),
    ]);
    expect(frozen.mediaVersion).toBe(2);
    expect(frozen.scenes[0]!.image?.objectKey).toBe("still.png");
    expect(frozen.scenes[1]!.image).toBeNull();
    expect(frozen.scenes[1]!.video).toMatchObject({
      selectionId,
      fit: "contain",
      trimStartMilliseconds: 500,
    });
    expect(frozen.scenes[1]!.cameraMotion).toBe("none");
    const keys = collectRenderAssetObjectKeys(frozen);
    expect(keys).toEqual([
      "still.png",
      "narration.mp3",
      "project-owned/clip.mp4",
    ]);
    const urls = Object.fromEntries(
      keys.map((key) => [key, `https://private.example/${key}`]),
    );
    const resolved = parseVideoCompositionInput(
      buildVideoCompositionInput({
        snapshot: frozen,
        imageUrlByObjectKey: urls,
        audioUrlByObjectKey: urls,
        watermarkText: "",
      }),
    );
    expect(resolved.scenes[1]!.video).toMatchObject({
      url: "https://private.example/project-owned/clip.mp4",
      trimBeforeFrames: 15,
      durationFrames: 105,
      fit: "contain",
      loop: false,
    });
    expect(
      buildPreviewAssets(resolved.scenes, 30).map((asset) => asset.url),
    ).not.toContain("https://private.example/project-owned/clip.mp4"); // Progressive video, not whole-file gallery/preview prefetch.
  });
  it("refuses missing, rejected and short video instead of falling back to an image", () => {
    const cases: Array<[TimelineVideoAsset | null, string]> = [
      [null, "missingVideo"],
      [{ ...video, approved: false }, "videoNotApproved"],
      [{ ...video, durationMilliseconds: 2000 }, "videoTooShort"],
      [{ ...video, trimStartMilliseconds: 5000 }, "invalidVideo"],
    ];
    for (const [clip, code] of cases) {
      const result = timeline([scene({ visualKind: "video", video: clip })]);
      expect(result.status).toBe("invalid");
      expect(result.report.issues.some((issue) => issue.code === code)).toBe(
        true,
      );
    }
  });
  it("allows explicit looping and preserves its original phase in a Short", () => {
    const result = timeline([
      scene({
        visualKind: "video",
        image: null,
        video: { ...video, loop: true, durationMilliseconds: 2000 },
      }),
    ]);
    if (result.status !== "ready")
      throw new Error("Loop should cover narration.");
    const short = buildShortTimeline({
      source: result.timeline,
      width: 1080,
      height: 1920,
      clips: [
        {
          id: otherId,
          sourceSceneId: sceneId,
          sourceSceneVersionId: versionId,
          position: 0,
          sourceStartMilliseconds: 1000,
          sourceEndMilliseconds: 2500,
          transition: "cut",
        },
      ],
    });
    expect(short.timeline.scenes[0]!.video).toMatchObject({
      trimStartMilliseconds: 500,
      sourceOffsetMilliseconds: 1000,
      loop: true,
      durationMilliseconds: 2000,
    });
    const frozen = buildRenderTimelineSnapshot({
      timeline: short.timeline,
      captionStyle: DEFAULT_CAPTION_STYLE,
      includeCaptions: true,
      includeWatermark: false,
    });
    const props = buildVideoCompositionInput({
      snapshot: frozen,
      imageUrlByObjectKey: {
        "project-owned/clip.mp4": "https://private.example/video",
      },
      audioUrlByObjectKey: { "narration.mp3": "https://private.example/audio" },
      watermarkText: "",
    });
    expect(props.scenes[0]!.video).toMatchObject({
      trimBeforeFrames: 15,
      durationFrames: 45,
      sourceOffsetFrames: 30,
      fit: "contain",
    });
  });
  it("requires a video-aware composition version and an actual signed video URL", () => {
    const frozen = snapshot([
      scene({ visualKind: "video", image: null, video }),
    ]);
    expect(() =>
      buildVideoCompositionInput({
        snapshot: frozen,
        imageUrlByObjectKey: {},
        audioUrlByObjectKey: { "narration.mp3": "https://example.com/audio" },
        watermarkText: "",
      }),
    ).toThrow("Missing signed video URL");
    const props = buildVideoCompositionInput({
      snapshot: frozen,
      imageUrlByObjectKey: {
        "project-owned/clip.mp4": "https://example.com/video",
      },
      audioUrlByObjectKey: { "narration.mp3": "https://example.com/audio" },
      watermarkText: "",
    });
    expect(() =>
      parseVideoCompositionInput({ ...props, mediaVersion: undefined }),
    ).toThrow("version 2");
    expect(() =>
      parseVideoCompositionInput({
        ...props,
        scenes: [{ ...props.scenes[0], imageUrl: "https://example.com/still" }],
      }),
    ).toThrow("exactly one visual");
  });
  it("keeps the historical image-only snapshot shape", () => {
    const frozen = snapshot([scene()]);
    expect(frozen).not.toHaveProperty("mediaVersion");
    expect(frozen.scenes[0]).not.toHaveProperty("video");
    expect(frozen.scenes[0]!.image).toMatchObject({ objectKey: "still.png" });
  });
});
