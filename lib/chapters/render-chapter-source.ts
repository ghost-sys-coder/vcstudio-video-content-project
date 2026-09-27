import type { VideoChaptersPromptScene } from "@studio/prompts";
import {
  formatChapterTimestamp,
  type ChapterSceneTiming,
} from "@/lib/chapters/youtube-chapters";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";

export interface RenderChapterSource {
  videoDurationMilliseconds: number;
  /** Where each scene starts in the uploaded video: the only legal chapter starts. */
  timings: ChapterSceneTiming[];
  promptScenes: VideoChaptersPromptScene[];
  /** Scenes described from current narration because the render kept no captions. */
  scenesFromCurrentNarration: number;
}

/**
 * Reads a render's frozen timeline into what chapter generation needs.
 *
 * Timing always comes from the snapshot, so it matches the uploaded file.
 * Words come from the snapshot's captions when the render kept them, which is
 * exactly what the video says; a render made with captions off kept none, and
 * then the scene's current narration stands in — close, but it may have been
 * edited since, which is why the count is reported.
 */
export function describeRenderForChapters(
  snapshot: RenderTimelineSnapshot,
  currentNarrationBySceneId: ReadonlyMap<string, string>,
): RenderChapterSource {
  const duration = snapshot.totalDurationMilliseconds;
  let scenesFromCurrentNarration = 0;
  const scenes = [...snapshot.scenes].sort(
    (left, right) => left.startMilliseconds - right.startMilliseconds,
  );

  const promptScenes = scenes.map((scene) => {
    const captioned = scene.captions
      .map((caption) => caption.text.trim())
      .filter((text) => text !== "")
      .join(" ");
    let narration = captioned;
    if (narration === "") {
      narration = currentNarrationBySceneId.get(scene.sceneId) ?? "";
      if (narration !== "") scenesFromCurrentNarration += 1;
    }
    return {
      sceneNumber: scene.sceneNumber,
      startLabel: formatChapterTimestamp(scene.startMilliseconds, duration),
      durationSeconds: Math.max(
        0,
        Math.round((scene.endMilliseconds - scene.startMilliseconds) / 1_000),
      ),
      narration,
    };
  });

  return {
    videoDurationMilliseconds: duration,
    timings: scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      startMilliseconds: scene.startMilliseconds,
    })),
    promptScenes,
    scenesFromCurrentNarration,
  };
}
