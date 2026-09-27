import { describe, expect, it } from "vitest";
import { describeRenderForChapters } from "@/lib/chapters/render-chapter-source";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";

function scene(
  sceneNumber: number,
  startMilliseconds: number,
  endMilliseconds: number,
  captions: string[],
) {
  return {
    sceneId: `scene-${sceneNumber}`,
    sceneNumber,
    startMilliseconds,
    endMilliseconds,
    captions: captions.map((text) => ({
      text,
      startMs: 0,
      endMs: 0,
      startFrame: 0,
      endFrame: 0,
    })),
  };
}

function snapshot(
  scenes: ReturnType<typeof scene>[],
  totalDurationMilliseconds: number,
): RenderTimelineSnapshot {
  // Only the fields chapter generation reads are meaningful here.
  return {
    totalDurationMilliseconds,
    scenes,
  } as unknown as RenderTimelineSnapshot;
}

describe("describeRenderForChapters", () => {
  it("takes words from the render's own captions and times from its scenes", () => {
    const source = describeRenderForChapters(
      snapshot(
        [
          scene(2, 12_000, 52_000, ["Here is", "the maths."]),
          scene(1, 0, 12_000, ["Most people never start."]),
        ],
        52_000,
      ),
      new Map([["scene-1", "Edited since the render."]]),
    );
    expect(source.timings).toEqual([
      { sceneNumber: 1, startMilliseconds: 0 },
      { sceneNumber: 2, startMilliseconds: 12_000 },
    ]);
    expect(source.promptScenes).toEqual([
      {
        sceneNumber: 1,
        startLabel: "0:00",
        durationSeconds: 12,
        narration: "Most people never start.",
      },
      {
        sceneNumber: 2,
        startLabel: "0:12",
        durationSeconds: 40,
        narration: "Here is the maths.",
      },
    ]);
    expect(source.scenesFromCurrentNarration).toBe(0);
  });

  it("falls back to current narration only where the render kept no captions, and says so", () => {
    const source = describeRenderForChapters(
      snapshot([scene(1, 0, 40_000, []), scene(2, 40_000, 80_000, [])], 80_000),
      new Map([["scene-1", "Current narration."]]),
    );
    expect(source.promptScenes.map((entry) => entry.narration)).toEqual([
      "Current narration.",
      "",
    ]);
    expect(source.scenesFromCurrentNarration).toBe(1);
  });
});
