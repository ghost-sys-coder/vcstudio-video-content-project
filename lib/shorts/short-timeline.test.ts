import { describe, expect, it } from "vitest";
import { buildShortTimeline } from "@/lib/shorts/short-timeline";
import type { VideoTimeline } from "@/lib/timeline/video-timeline";

const source: VideoTimeline = {
  width: 1920,
  height: 1080,
  framesPerSecond: 30,
  paddingMilliseconds: 0,
  totalDurationMilliseconds: 10_000,
  totalFrames: 300,
  captionCount: 2,
  scenes: [
    {
      sceneId: "11111111-1111-4111-8111-111111111111",
      sceneVersionId: "22222222-2222-4222-8222-222222222222",
      sceneNumber: 1,
      startMilliseconds: 0,
      endMilliseconds: 10_000,
      durationMilliseconds: 10_000,
      startFrame: 0,
      endFrame: 300,
      durationFrames: 300,
      image: {
        generationId: "image-1",
        objectKey: "image.webp",
        width: 1536,
        height: 1024,
      },
      audio: {
        generationId: "audio-1",
        objectKey: "audio.mp3",
        durationMilliseconds: 10_000,
        format: "mp3",
      },
      cameraMotion: "zoomIn",
      transition: "cut",
      captions: [
        {
          text: "Opening sentence",
          startMs: 0,
          endMs: 4000,
          startFrame: 0,
          endFrame: 120,
        },
        {
          text: "Closing sentence",
          startMs: 4000,
          endMs: 10_000,
          startFrame: 120,
          endFrame: 300,
        },
      ],
    },
  ],
};

describe("buildShortTimeline", () => {
  it("trims source audio and rebases captions into a vertical timeline", () => {
    const result = buildShortTimeline({
      source,
      width: 1080,
      height: 1920,
      clips: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          sourceSceneId: source.scenes[0]!.sceneId,
          sourceSceneVersionId: source.scenes[0]!.sceneVersionId,
          position: 1,
          sourceStartMilliseconds: 4000,
          sourceEndMilliseconds: 8000,
          transition: "cut",
        },
      ],
    });
    expect(result.timeline).toMatchObject({
      width: 1080,
      height: 1920,
      totalDurationMilliseconds: 4000,
      totalFrames: 120,
    });
    expect(result.timeline.scenes[0]).toMatchObject({
      audioTrimBeforeFrames: 120,
      startMilliseconds: 0,
      endMilliseconds: 4000,
    });
    expect(result.timeline.scenes[0]!.captions[0]).toMatchObject({
      startMs: 0,
      endMs: 4000,
    });
  });

  it("warns when an exact cut crosses a subtitle cue", () => {
    const result = buildShortTimeline({
      source,
      width: 1080,
      height: 1920,
      clips: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          sourceSceneId: source.scenes[0]!.sceneId,
          sourceSceneVersionId: source.scenes[0]!.sceneVersionId,
          position: 1,
          sourceStartMilliseconds: 1000,
          sourceEndMilliseconds: 3000,
          transition: "cut",
        },
      ],
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe("captionBoundaryCut");
  });

  it("rejects a range outside its source scene", () => {
    expect(() =>
      buildShortTimeline({
        source,
        width: 1080,
        height: 1920,
        clips: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            sourceSceneId: source.scenes[0]!.sceneId,
            sourceSceneVersionId: source.scenes[0]!.sceneVersionId,
            position: 1,
            sourceStartMilliseconds: 9000,
            sourceEndMilliseconds: 11_000,
            transition: "cut",
          },
        ],
      }),
    ).toThrow(/outside/);
  });
});
