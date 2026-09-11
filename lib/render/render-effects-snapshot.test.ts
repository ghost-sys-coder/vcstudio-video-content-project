import { describe, expect, it } from "vitest";
import { buildRenderTimelineSnapshot } from "@/lib/render/build-render-snapshot";
import { collectRenderAssetObjectKeys } from "@/lib/render/render-asset-keys";
import {
  buildVideoCompositionInput,
  videoCompositionInputSchema,
} from "@/lib/render/render-composition-input";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";
import type { VideoTimeline } from "@/lib/timeline/video-timeline";

const SCENE_ID = "11111111-1111-4111-8111-111111111111";

/** A 2-second scene at 30fps, with a 50 Hz envelope covering it. */
function timeline(): VideoTimeline {
  return {
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    paddingMilliseconds: 0,
    totalDurationMilliseconds: 2000,
    totalFrames: 60,
    issues: [],
    report: { ready: true, issues: [] },
    scenes: [
      {
        sceneId: SCENE_ID,
        sceneNumber: 1,
        sceneVersionId: "22222222-2222-4222-8222-222222222222",
        startMilliseconds: 0,
        endMilliseconds: 2000,
        durationMilliseconds: 2000,
        startFrame: 0,
        endFrame: 60,
        durationFrames: 60,
        image: {
          generationId: "img",
          objectKey: "scene.webp",
          width: 1536,
          height: 1024,
        },
        additionalShots: [],
        audio: {
          generationId: "aud",
          objectKey: "scene.mp3",
          durationMilliseconds: 2000,
          format: "mp3",
          amplitudeEnvelope: Array.from({ length: 100 }, (_, i) => i % 100),
        },
        cameraMotion: "none",
        transition: "cut",
        captions: [],
      },
    ],
  } as unknown as VideoTimeline;
}

function snapshot(
  effects?: Parameters<typeof buildRenderTimelineSnapshot>[0]["effects"],
) {
  return buildRenderTimelineSnapshot({
    timeline: timeline(),
    captionStyle: DEFAULT_CAPTION_STYLE,
    includeCaptions: true,
    includeWatermark: false,
    ...(effects ? { effects } : {}),
  });
}

const BED = {
  backgroundAudio: {
    objectKey: "beds/calm.mp3",
    volumePercent: 12,
    loop: true,
  },
};

describe("a project with no effects", () => {
  it("freezes a snapshot with neither, so an old render is unchanged", () => {
    const built = snapshot();
    expect("backgroundAudio" in built).toBe(false);
    expect("levelMeter" in built).toBe(false);
  });

  it("does not carry the narration envelope it would never draw", () => {
    // Copying a per-frame array into every stored render for a feature that is
    // switched off is pure weight.
    expect("amplitudeEnvelope" in snapshot().scenes[0]!.audio).toBe(false);
  });
});

describe("a project with a sound bed", () => {
  it("freezes the bed, and signs it as an asset the render needs", () => {
    const built = snapshot(BED);
    expect(built.backgroundAudio?.objectKey).toBe("beds/calm.mp3");
    expect(collectRenderAssetObjectKeys(built)).toContain("beds/calm.mp3");
  });

  it("converts the stored percent to a fraction for the renderer", () => {
    const built = snapshot(BED);
    const input = buildVideoCompositionInput({
      snapshot: built,
      imageUrlByObjectKey: { "scene.webp": "https://a.example.com/i.webp" },
      audioUrlByObjectKey: {
        "scene.mp3": "https://a.example.com/a.mp3",
        "beds/calm.mp3": "https://a.example.com/bed.mp3",
      },
      watermarkText: "",
    });
    expect(input.backgroundAudio?.volume).toBeCloseTo(0.12);
    expect(videoCompositionInputSchema.safeParse(input).success).toBe(true);
  });

  it("refuses to render in silence when the bed has no signed URL", () => {
    // A video that quietly lost its sound bed looks finished and is not.
    expect(() =>
      buildVideoCompositionInput({
        snapshot: snapshot(BED),
        imageUrlByObjectKey: { "scene.webp": "https://a.example.com/i.webp" },
        audioUrlByObjectKey: { "scene.mp3": "https://a.example.com/a.mp3" },
        watermarkText: "",
      }),
    ).toThrow(/background audio/i);
  });
});

describe("a project with the level meter on", () => {
  const withMeter = { levelMeter: { position: "topLeft" as const } };

  it("freezes the meter position", () => {
    expect(snapshot(withMeter).levelMeter).toEqual({ position: "topLeft" });
  });

  it("carries the narration envelope so the meter has something to follow", () => {
    expect(snapshot(withMeter).scenes[0]!.audio.amplitudeEnvelope).toHaveLength(
      100,
    );
  });

  it("resamples the envelope to one value per frame of the scene", () => {
    const input = buildVideoCompositionInput({
      snapshot: snapshot(withMeter),
      imageUrlByObjectKey: { "scene.webp": "https://a.example.com/i.webp" },
      audioUrlByObjectKey: { "scene.mp3": "https://a.example.com/a.mp3" },
      watermarkText: "",
    });
    // 2 seconds at 30fps is 60 frames, from 100 envelope samples at 50 Hz.
    expect(input.scenes[0]?.narrationEnvelope).toHaveLength(60);
    expect(videoCompositionInputSchema.safeParse(input).success).toBe(true);
  });

  it("keeps every resampled value within the range the renderer expects", () => {
    const input = buildVideoCompositionInput({
      snapshot: snapshot(withMeter),
      imageUrlByObjectKey: { "scene.webp": "https://a.example.com/i.webp" },
      audioUrlByObjectKey: { "scene.mp3": "https://a.example.com/a.mp3" },
      watermarkText: "",
    });
    for (const value of input.scenes[0]?.narrationEnvelope ?? []) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
