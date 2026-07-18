import { describe, expect, it } from "vitest";
import {
  AHEAD_PRELOAD_SECONDS,
  BEHIND_RETENTION_SECONDS,
  buildPreviewAssets,
  initialPreloadUrls,
  selectPreloadUrls,
} from "@/lib/render/preview-preload-plan";
import type { VideoCompositionScene } from "@/lib/render/video-composition-data";

function scene(
  overrides: Partial<VideoCompositionScene> & {
    sceneId: string;
    sceneNumber: number;
    startFrame: number;
    durationFrames: number;
  },
): VideoCompositionScene {
  return {
    cameraMotion: "none",
    transition: "cut",
    imageUrl: `https://cdn.test/${overrides.sceneId}-image`,
    audioUrl: `https://cdn.test/${overrides.sceneId}-audio`,
    captions: [],
    ...overrides,
  };
}

// Three 10-second scenes back to back at 30fps: [0,10) [10,20) [20,30).
const scenes: VideoCompositionScene[] = [
  scene({ sceneId: "s1", sceneNumber: 1, startFrame: 0, durationFrames: 300 }),
  scene({
    sceneId: "s2",
    sceneNumber: 2,
    startFrame: 300,
    durationFrames: 300,
  }),
  scene({
    sceneId: "s3",
    sceneNumber: 3,
    startFrame: 600,
    durationFrames: 300,
  }),
];

describe("buildPreviewAssets", () => {
  it("emits an image and audio asset per scene with wall-clock intervals", () => {
    const assets = buildPreviewAssets(scenes, 30);
    expect(assets).toHaveLength(6);
    const s2Image = assets.find((asset) => asset.key === "s2:image");
    expect(s2Image).toMatchObject({
      type: "image",
      sceneNumber: 2,
      startSeconds: 10,
      endSeconds: 20,
      url: "https://cdn.test/s2-image",
    });
  });

  it("guards against a zero framerate", () => {
    const assets = buildPreviewAssets(scenes, 0);
    expect(assets.every((asset) => Number.isFinite(asset.startSeconds))).toBe(
      true,
    );
  });
});

describe("initialPreloadUrls", () => {
  it("includes only assets that start within the initial window", () => {
    const assets = buildPreviewAssets(scenes, 30);
    const urls = initialPreloadUrls(assets, 12);
    // Scenes 1 (t=0) and 2 (t=10) start within 12s; scene 3 (t=20) does not.
    expect(urls.has("https://cdn.test/s1-image")).toBe(true);
    expect(urls.has("https://cdn.test/s2-audio")).toBe(true);
    expect(urls.has("https://cdn.test/s3-image")).toBe(false);
  });

  it("always includes the first scene even when it is longer than the window", () => {
    const longFirst = buildPreviewAssets(
      [
        scene({
          sceneId: "s1",
          sceneNumber: 1,
          startFrame: 0,
          durationFrames: 3000,
        }),
      ],
      30,
    );
    const urls = initialPreloadUrls(longFirst, 5);
    expect(urls.has("https://cdn.test/s1-image")).toBe(true);
    expect(urls.has("https://cdn.test/s1-audio")).toBe(true);
  });
});

describe("selectPreloadUrls", () => {
  const assets = buildPreviewAssets(scenes, 30);

  it("keeps assets overlapping the ahead/behind band around the playhead", () => {
    const urls = selectPreloadUrls({
      assets,
      currentSeconds: 10.5,
      aheadSeconds: 5,
      behindSeconds: 2,
    });
    // Band is [8.5, 15.5]: scene 1 [0,10) overlaps via behind, scene 2 [10,20)
    // is current; scene 3 [20,30) is out of range.
    expect(urls.has("https://cdn.test/s2-image")).toBe(true);
    expect(urls.has("https://cdn.test/s1-audio")).toBe(true);
    expect(urls.has("https://cdn.test/s3-image")).toBe(false);
  });

  it("always retains the first scene for instant loop restart", () => {
    const urls = selectPreloadUrls({
      assets,
      currentSeconds: 25,
      aheadSeconds: 2,
      behindSeconds: 2,
    });
    expect(urls.has("https://cdn.test/s1-image")).toBe(true);
  });

  it("does not preload the whole project ahead of the playhead", () => {
    const many = buildPreviewAssets(
      Array.from({ length: 60 }, (_, index) =>
        scene({
          sceneId: `x${index}`,
          sceneNumber: index + 1,
          startFrame: index * 300,
          durationFrames: 300,
        }),
      ),
      30,
    );
    const urls = selectPreloadUrls({ assets: many, currentSeconds: 0 });
    // Default ahead window is 30s => at most ~4 scenes (8 assets) resident.
    expect(urls.size).toBeLessThan(many.length);
    expect(AHEAD_PRELOAD_SECONDS).toBeGreaterThan(BEHIND_RETENTION_SECONDS);
  });
});
