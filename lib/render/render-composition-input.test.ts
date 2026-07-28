import { describe, expect, it } from "vitest";
import {
  buildVideoCompositionInput,
  videoCompositionInputSchema,
} from "@/lib/render/render-composition-input";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";
import type { VideoCompositionInput } from "@/lib/render/video-composition-data";

const SCENE_ID = "11111111-1111-4111-8111-111111111111";

function validInput(): VideoCompositionInput {
  return {
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    durationInFrames: 60,
    includeCaptions: true,
    includeWatermark: false,
    watermarkText: "",
    captionStyle: DEFAULT_CAPTION_STYLE,
    scenes: [
      {
        sceneId: SCENE_ID,
        sceneNumber: 1,
        startFrame: 0,
        durationFrames: 60,
        cameraMotion: "zoomIn",
        transition: "fade",
        imageUrl: "https://assets.example.com/img.webp",
        audioUrl: "https://assets.example.com/aud.mp3",
        captions: [
          { text: "Hi", startMs: 0, endMs: 2000, startFrame: 0, endFrame: 60 },
        ],
      },
    ],
  };
}

describe("videoCompositionInputSchema", () => {
  it("accepts a well-formed composition input", () => {
    expect(videoCompositionInputSchema.safeParse(validInput()).success).toBe(
      true,
    );
  });

  it("rejects an empty scene list", () => {
    const input = { ...validInput(), scenes: [] };
    expect(videoCompositionInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects non-positive geometry and framerate", () => {
    expect(
      videoCompositionInputSchema.safeParse({ ...validInput(), width: 0 })
        .success,
    ).toBe(false);
    expect(
      videoCompositionInputSchema.safeParse({
        ...validInput(),
        framesPerSecond: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed asset URL", () => {
    const input = validInput();
    input.scenes[0]!.imageUrl = "not-a-url";
    expect(videoCompositionInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a caption whose end precedes its start", () => {
    const input = validInput();
    input.scenes[0]!.captions[0]!.endFrame = 0;
    input.scenes[0]!.captions[0]!.startFrame = 10;
    expect(videoCompositionInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects unknown top-level keys", () => {
    const input = { ...validInput(), rogue: true };
    expect(videoCompositionInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("buildVideoCompositionInput", () => {
  const snapshot: RenderTimelineSnapshot = {
    width: 1080,
    height: 1920,
    framesPerSecond: 30,
    totalDurationMilliseconds: 2000,
    totalFrames: 60,
    includeCaptions: true,
    includeWatermark: true,
    captionStyle: DEFAULT_CAPTION_STYLE,
    scenes: [
      {
        sceneId: SCENE_ID,
        sceneNumber: 1,
        startMilliseconds: 0,
        endMilliseconds: 2000,
        startFrame: 0,
        endFrame: 60,
        durationFrames: 60,
        cameraMotion: "panLeft",
        transition: "cut",
        image: {
          objectKey: "img-key",
          width: 1536,
          height: 1024,
          framing: {
            mode: "cover",
            focalPointXBps: 2500,
            focalPointYBps: 6000,
            scaleBps: 11000,
            backgroundColor: "#000000",
          },
        },
        audio: {
          objectKey: "aud-key",
          durationMilliseconds: 2000,
          format: "mp3",
        },
        captions: [
          { text: "Hi", startMs: 0, endMs: 2000, startFrame: 0, endFrame: 60 },
        ],
      },
    ],
  };

  it("resolves object keys to signed urls and validates", () => {
    const input = buildVideoCompositionInput({
      snapshot,
      imageUrlByObjectKey: { "img-key": "https://cdn.example.com/i.webp" },
      audioUrlByObjectKey: { "aud-key": "https://cdn.example.com/a.mp3" },
      watermarkText: "STUDIO",
    });
    expect(input.scenes[0]!.imageUrl).toBe("https://cdn.example.com/i.webp");
    expect(input.scenes[0]!.imageFraming).toMatchObject({
      focalPointXBps: 2500,
      scaleBps: 11000,
    });
    expect(input.durationInFrames).toBe(60);
    expect(input.watermarkText).toBe("STUDIO");
    expect(videoCompositionInputSchema.safeParse(input).success).toBe(true);
  });

  it("drops caption cues when captions are disabled", () => {
    const input = buildVideoCompositionInput({
      snapshot: { ...snapshot, includeCaptions: false },
      imageUrlByObjectKey: { "img-key": "https://cdn.example.com/i.webp" },
      audioUrlByObjectKey: { "aud-key": "https://cdn.example.com/a.mp3" },
      watermarkText: "",
    });
    expect(input.scenes[0]!.captions).toEqual([]);
  });

  it("throws when a signed url is missing for an asset", () => {
    expect(() =>
      buildVideoCompositionInput({
        snapshot,
        imageUrlByObjectKey: {},
        audioUrlByObjectKey: { "aud-key": "https://cdn.example.com/a.mp3" },
        watermarkText: "",
      }),
    ).toThrow(/image URL/);
  });
});
