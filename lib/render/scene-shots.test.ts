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
const VERSION_ID = "22222222-2222-4222-8222-222222222222";

function image(objectKey: string) {
  return { generationId: objectKey, objectKey, width: 1536, height: 1024 };
}

/** A 12-second scene at 30fps with four caption lines. */
function timeline(additionalShots: ReturnType<typeof image>[]): VideoTimeline {
  return {
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    paddingMilliseconds: 0,
    totalDurationMilliseconds: 12_000,
    totalFrames: 360,
    issues: [],
    report: { ready: true, issues: [] },
    scenes: [
      {
        sceneId: SCENE_ID,
        sceneNumber: 1,
        sceneVersionId: VERSION_ID,
        startMilliseconds: 0,
        endMilliseconds: 12_000,
        durationMilliseconds: 12_000,
        startFrame: 0,
        endFrame: 360,
        durationFrames: 360,
        image: image("scene-1-shot-0.webp"),
        additionalShots,
        audio: {
          generationId: "aud",
          objectKey: "scene-1.mp3",
          durationMilliseconds: 12_000,
          format: "mp3",
        },
        cameraMotion: "none",
        transition: "cut",
        captions: [
          { text: "a", startMs: 0, endMs: 3400, startFrame: 0, endFrame: 102 },
          {
            text: "b",
            startMs: 3400,
            endMs: 6100,
            startFrame: 102,
            endFrame: 183,
          },
          {
            text: "c",
            startMs: 6100,
            endMs: 9200,
            startFrame: 183,
            endFrame: 276,
          },
          {
            text: "d",
            startMs: 9200,
            endMs: 12_000,
            startFrame: 276,
            endFrame: 360,
          },
        ],
      },
    ],
  } as unknown as VideoTimeline;
}

function snapshot(additionalShots: ReturnType<typeof image>[]) {
  return buildRenderTimelineSnapshot({
    timeline: timeline(additionalShots),
    captionStyle: DEFAULT_CAPTION_STYLE,
    includeCaptions: true,
    includeWatermark: false,
  });
}

describe("a scene that still has one image", () => {
  it("carries no shots at all, so an existing render is unchanged", () => {
    // Absent, not an empty array: a frozen snapshot has to stay byte-identical
    // or a re-render of an old video would not reproduce.
    const scene = snapshot([]).scenes[0]!;
    expect(scene.shots).toBeUndefined();
    expect("shots" in scene).toBe(false);
  });
});

describe("a scene that changes image", () => {
  const scene = () => snapshot([image("scene-1-shot-1.webp")]).scenes[0]!;

  it("splits the scene into as many shots as it has images", () => {
    expect(scene().shots).toHaveLength(2);
  });

  it("changes image on a caption boundary", () => {
    // Even division wants 6000ms, frame 180. The nearest caption starts at
    // 6100ms, frame 183.
    expect(scene().shots?.[1]?.startFrame).toBe(183);
    expect(scene().shots?.[1]?.startedOnCueBoundary).toBe(true);
  });

  it("covers the scene from its first frame to its last, with no gap", () => {
    const shots = scene().shots ?? [];
    expect(shots[0]?.startFrame).toBe(0);
    expect(shots[shots.length - 1]?.endFrame).toBe(360);
    for (let index = 0; index < shots.length - 1; index += 1)
      expect(shots[index]?.endFrame).toBe(shots[index + 1]?.startFrame);
  });

  it("keeps the scene's representative image populated", () => {
    // Anything that does not understand shots must still show the scene.
    expect(scene().image.objectKey).toBe("scene-1-shot-0.webp");
    expect(scene().shots?.[0]?.objectKey).toBe("scene-1-shot-0.webp");
  });

  it("uses each image in the order it was approved", () => {
    expect(scene().shots?.map((shot) => shot.objectKey)).toEqual([
      "scene-1-shot-0.webp",
      "scene-1-shot-1.webp",
    ]);
  });
});

describe("signing the assets a render needs", () => {
  it("includes every shot's image, not only the scene's first", () => {
    // A key missed here becomes a shot that cannot load, so this is the guard
    // against the preview and the worker drifting apart.
    const keys = collectRenderAssetObjectKeys(
      snapshot([image("scene-1-shot-1.webp")]),
    );
    expect(keys).toContain("scene-1-shot-0.webp");
    expect(keys).toContain("scene-1-shot-1.webp");
    expect(keys).toContain("scene-1.mp3");
  });

  it("lists a reused still once", () => {
    const keys = collectRenderAssetObjectKeys(snapshot([]));
    expect(keys.filter((key) => key === "scene-1-shot-0.webp")).toHaveLength(1);
  });
});

describe("resolving shots to signed URLs", () => {
  const built = snapshot([image("scene-1-shot-1.webp")]);
  const urls = {
    "scene-1-shot-0.webp": "https://assets.example.com/a.webp",
    "scene-1-shot-1.webp": "https://assets.example.com/b.webp",
    "scene-1.mp3": "https://assets.example.com/a.mp3",
  };

  it("produces a composition the renderer accepts", () => {
    const input = buildVideoCompositionInput({
      snapshot: built,
      imageUrlByObjectKey: urls,
      audioUrlByObjectKey: urls,
      watermarkText: "",
    });
    expect(videoCompositionInputSchema.safeParse(input).success).toBe(true);
    expect(input.scenes[0]?.shots).toHaveLength(2);
  });

  it("refuses rather than silently repeating the first image", () => {
    // Falling back would render a scene that looks like the feature never
    // applied, and nothing would report it.
    expect(() =>
      buildVideoCompositionInput({
        snapshot: built,
        imageUrlByObjectKey: {
          "scene-1-shot-0.webp": urls["scene-1-shot-0.webp"],
          "scene-1.mp3": urls["scene-1.mp3"],
        },
        audioUrlByObjectKey: urls,
        watermarkText: "",
      }),
    ).toThrow(/shot/i);
  });

  it("rejects overlapping shots", () => {
    const input = buildVideoCompositionInput({
      snapshot: built,
      imageUrlByObjectKey: urls,
      audioUrlByObjectKey: urls,
      watermarkText: "",
    });
    const broken = {
      ...input,
      scenes: [
        {
          ...input.scenes[0]!,
          shots: [
            {
              imageUrl: urls["scene-1-shot-0.webp"],
              startFrame: 0,
              endFrame: 200,
            },
            {
              imageUrl: urls["scene-1-shot-1.webp"],
              startFrame: 100,
              endFrame: 360,
            },
          ],
        },
      ],
    };
    expect(videoCompositionInputSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a single-entry shot list, which would mean a change that never happens", () => {
    const input = buildVideoCompositionInput({
      snapshot: built,
      imageUrlByObjectKey: urls,
      audioUrlByObjectKey: urls,
      watermarkText: "",
    });
    const broken = {
      ...input,
      scenes: [{ ...input.scenes[0]!, shots: [input.scenes[0]!.shots![0]!] }],
    };
    expect(videoCompositionInputSchema.safeParse(broken).success).toBe(false);
  });
});
