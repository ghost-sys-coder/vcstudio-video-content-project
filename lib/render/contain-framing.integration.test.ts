import { describe, expect, it } from "vitest";
import { buildRenderTimelineSnapshot } from "./build-render-snapshot";
import { buildVideoCompositionInput } from "./render-composition-input";
import { cameraTransformAtProgress } from "./camera-motion";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";
import { DEFAULT_SCENE_FRAMING } from "@/lib/output-variants/scene-framing";
import { PACING_PROFILES } from "@/lib/pacing/pacing-profile";
import type {
  VideoTimeline,
  TimelineImageAsset,
} from "@/lib/timeline/video-timeline";
function image(contain = true): TimelineImageAsset {
  return {
    generationId: "image",
    objectKey: "image.png",
    width: 1536,
    height: 1024,
    framing: { ...DEFAULT_SCENE_FRAMING, mode: contain ? "contain" : "cover" },
  };
}
function snapshot(
  primary = image(),
  additionalShots: TimelineImageAsset[] = [],
  duration = 12000,
) {
  const timeline: VideoTimeline = {
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    paddingMilliseconds: 0,
    totalDurationMilliseconds: duration,
    totalFrames: (duration * 30) / 1000,
    captionCount: 0,
    scenes: [
      {
        sceneId: "11111111-1111-4111-8111-111111111111",
        sceneNumber: 1,
        sceneVersionId: "22222222-2222-4222-8222-222222222222",
        startMilliseconds: 0,
        endMilliseconds: duration,
        durationMilliseconds: duration,
        startFrame: 0,
        endFrame: (duration * 30) / 1000,
        durationFrames: (duration * 30) / 1000,
        image: primary,
        additionalShots,
        audio: {
          generationId: "audio",
          objectKey: "audio.mp3",
          durationMilliseconds: duration,
          format: "mp3",
        },
        cameraMotion: "none",
        transition: "cut",
        captions: [],
      },
    ],
  };
  return (profile = PACING_PROFILES.explainer) =>
    buildRenderTimelineSnapshot({
      timeline,
      captionStyle: DEFAULT_CAPTION_STYLE,
      includeCaptions: false,
      includeWatermark: false,
      pacingProfile: profile,
    });
}
describe("show-all framing in new preview and render snapshots", () => {
  it.each(Object.values(PACING_PROFILES))(
    "keeps the whole 3:2 canvas visible in 16:9 throughout $id playback",
    (profile) => {
      const frozen = snapshot()(profile);
      const composition = buildVideoCompositionInput({
        snapshot: frozen,
        imageUrlByObjectKey: { "image.png": "https://example.com/image.png" },
        audioUrlByObjectKey: { "audio.mp3": "https://example.com/audio.mp3" },
        watermarkText: "",
      });
      expect(composition.scenes[0]?.imageFraming).toMatchObject({
        mode: "contain",
        scaleBps: 10000,
      });
      for (const progress of [0, 0.5, 1])
        expect(
          cameraTransformAtProgress(
            composition.scenes[0]!.cameraMotion,
            progress,
          ),
        ).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    },
  );
  it("preserves the pacing profile for cover images and historical frozen snapshots", () => {
    const frozen = snapshot(image(false))();
    expect(frozen.scenes[0]?.cameraMotion).toBe("zoomIn");
    // Conversion must never rewrite motion already stored in a historical snapshot.
    frozen.scenes[0]!.image.framing = {
      ...DEFAULT_SCENE_FRAMING,
      mode: "contain",
    };
    const composition = buildVideoCompositionInput({
      snapshot: frozen,
      imageUrlByObjectKey: { "image.png": "https://example.com/image.png" },
      audioUrlByObjectKey: { "audio.mp3": "https://example.com/audio.mp3" },
      watermarkText: "",
    });
    expect(composition.scenes[0]?.cameraMotion).toBe("zoomIn");
  });
  it("protects contain shots in mixed scenes, but ignores shots dropped by a too-short scene", () => {
    expect(snapshot(image(false), [image()])().scenes[0]?.cameraMotion).toBe(
      "none",
    );
    expect(
      snapshot(image(false), [image()], 500)().scenes[0]?.cameraMotion,
    ).toBe("zoomIn");
  });
});
