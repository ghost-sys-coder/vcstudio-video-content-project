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

  describe("animated characters", () => {
    const CHARACTER_ID = "22222222-2222-4222-8222-222222222222";
    const OTHER_ID = "33333333-3333-4333-8333-333333333333";

    const poseUrls = {
      "idle-key": "https://cdn.example.com/idle.png",
      "talk-open-key": "https://cdn.example.com/open.png",
      "talk-closed-key": "https://cdn.example.com/closed.png",
      "blink-key": "https://cdn.example.com/blink.png",
      "img-key": "https://cdn.example.com/i.webp",
    };

    function character(overrides: Record<string, unknown> = {}) {
      return {
        characterId: CHARACTER_ID,
        name: "Frank",
        stageSlot: "left" as const,
        isSpeaker: true,
        poses: {
          idle: "idle-key",
          talkOpen: "talk-open-key",
          talkClosed: "talk-closed-key",
          blink: "blink-key",
        },
        ...overrides,
      };
    }

    function withCharacters(
      characters: ReturnType<typeof character>[],
    ): RenderTimelineSnapshot {
      return {
        ...snapshot,
        scenes: [{ ...snapshot.scenes[0]!, characters }],
      };
    }

    function build(snapshotWithCast: RenderTimelineSnapshot) {
      return buildVideoCompositionInput({
        snapshot: snapshotWithCast,
        imageUrlByObjectKey: poseUrls,
        audioUrlByObjectKey: { "aud-key": "https://cdn.example.com/a.mp3" },
        watermarkText: "",
      });
    }

    it("resolves every pose object key to a signed url", () => {
      const input = build(withCharacters([character()]));
      const resolved = input.scenes[0]!.characters![0]!;
      expect(resolved.idleUrl).toBe("https://cdn.example.com/idle.png");
      expect(resolved.talkOpenUrl).toBe("https://cdn.example.com/open.png");
      expect(resolved.talkClosedUrl).toBe("https://cdn.example.com/closed.png");
      expect(resolved.blinkUrl).toBe("https://cdn.example.com/blink.png");
      expect(videoCompositionInputSchema.safeParse(input).success).toBe(true);
    });

    it("throws when a pose still has no signed url rather than rendering a gap", () => {
      expect(() =>
        buildVideoCompositionInput({
          snapshot: withCharacters([character()]),
          imageUrlByObjectKey: { "img-key": poseUrls["img-key"] },
          audioUrlByObjectKey: { "aud-key": "https://cdn.example.com/a.mp3" },
          watermarkText: "",
        }),
      ).toThrow(/pose URL for Frank/);
    });

    it("resamples the speaker's stored envelope to one value per frame", () => {
      // 2 stored samples at 1 Hz over a 60-frame, 30fps scene: the first second
      // is loud, the second silent.
      const input = build(
        withCharacters([
          character({
            amplitudeEnvelope: [100, 0],
            amplitudeSampleRateHz: 1,
          }),
        ]),
      );
      const envelope = input.scenes[0]!.characters![0]!.amplitudeEnvelope;
      expect(envelope).toHaveLength(60);
      expect(envelope[0]).toBe(1);
      expect(envelope[29]).toBe(1);
      expect(envelope[30]).toBe(0);
    });

    it("gives non-speakers an empty envelope so they idle", () => {
      const input = build(withCharacters([character({ isSpeaker: false })]));
      expect(input.scenes[0]!.characters![0]!.amplitudeEnvelope).toEqual([]);
    });

    it("faces a two-hander inward and leaves a solo character facing camera", () => {
      const pair = build(
        withCharacters([
          character({ stageSlot: "left" }),
          character({ characterId: OTHER_ID, stageSlot: "right" }),
        ]),
      ).scenes[0]!.characters!;
      expect(pair.find((c) => c.stageSlot === "left")!.faceLeft).toBe(false);
      expect(pair.find((c) => c.stageSlot === "right")!.faceLeft).toBe(true);

      const solo = build(withCharacters([character({ stageSlot: "right" })]))
        .scenes[0]!.characters![0]!;
      expect(solo.faceLeft).toBe(false);
    });

    it("leaves characters absent entirely for a static-image project", () => {
      const input = build(snapshot);
      expect(input.scenes[0]!.characters).toBeUndefined();
      expect(videoCompositionInputSchema.safeParse(input).success).toBe(true);
    });
  });
});
