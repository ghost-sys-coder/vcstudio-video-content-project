import { millisecondsToFrames } from "@/lib/timeline/scene-timeline";
import type {
  SceneTransition,
  VideoTimeline,
} from "@/lib/timeline/video-timeline";

export interface ShortClipDefinition {
  id: string;
  sourceSceneId: string;
  sourceSceneVersionId: string;
  position: number;
  sourceStartMilliseconds: number;
  sourceEndMilliseconds: number;
  transition: SceneTransition;
}

export interface ShortTimelineWarning {
  clipId: string;
  code: "captionBoundaryCut";
  message: string;
}

export function buildShortTimeline(input: {
  source: VideoTimeline;
  clips: ShortClipDefinition[];
  width: number;
  height: number;
}): { timeline: VideoTimeline; warnings: ShortTimelineWarning[] } {
  if (input.clips.length === 0)
    throw new RangeError("A short must include at least one clip.");
  const ordered = [...input.clips].sort(
    (left, right) => left.position - right.position,
  );
  if (new Set(ordered.map((clip) => clip.position)).size !== ordered.length)
    throw new RangeError("Short clip positions must be unique.");

  const warnings: ShortTimelineWarning[] = [];
  const scenes: VideoTimeline["scenes"] = [];
  let cursorMilliseconds = 0;

  for (const [index, clip] of ordered.entries()) {
    const source = input.source.scenes.find(
      (scene) =>
        scene.sceneId === clip.sourceSceneId &&
        scene.sceneVersionId === clip.sourceSceneVersionId,
    );
    if (!source)
      throw new RangeError("A short clip source scene was not found.");
    if (
      clip.sourceStartMilliseconds < source.startMilliseconds ||
      clip.sourceEndMilliseconds > source.endMilliseconds ||
      clip.sourceEndMilliseconds <= clip.sourceStartMilliseconds
    )
      throw new RangeError("A short clip range is outside its source scene.");

    const durationMilliseconds =
      clip.sourceEndMilliseconds - clip.sourceStartMilliseconds;
    const startMilliseconds = cursorMilliseconds;
    const endMilliseconds = startMilliseconds + durationMilliseconds;
    const startFrame = millisecondsToFrames(
      startMilliseconds,
      input.source.framesPerSecond,
    );
    const endFrame = millisecondsToFrames(
      endMilliseconds,
      input.source.framesPerSecond,
    );
    const relativeSourceStart =
      clip.sourceStartMilliseconds - source.startMilliseconds;

    const captions = source.captions
      .filter(
        (caption) =>
          caption.endMs > clip.sourceStartMilliseconds &&
          caption.startMs < clip.sourceEndMilliseconds,
      )
      .map((caption) => {
        if (
          caption.startMs < clip.sourceStartMilliseconds ||
          caption.endMs > clip.sourceEndMilliseconds
        )
          warnings.push({
            clipId: clip.id,
            code: "captionBoundaryCut",
            message:
              "This cut crosses a subtitle cue. Snap to the cue boundary for cleaner captions.",
          });
        const captionStart =
          startMilliseconds +
          Math.max(0, caption.startMs - clip.sourceStartMilliseconds);
        const captionEnd =
          startMilliseconds +
          Math.min(
            durationMilliseconds,
            caption.endMs - clip.sourceStartMilliseconds,
          );
        return {
          ...caption,
          startMs: captionStart,
          endMs: captionEnd,
          startFrame: millisecondsToFrames(
            captionStart,
            input.source.framesPerSecond,
          ),
          endFrame: millisecondsToFrames(
            captionEnd,
            input.source.framesPerSecond,
          ),
        };
      });

    scenes.push({
      ...source,
      sceneId: clip.id,
      sceneNumber: index + 1,
      startMilliseconds,
      endMilliseconds,
      durationMilliseconds,
      startFrame,
      endFrame,
      durationFrames: endFrame - startFrame,
      audioTrimBeforeFrames: millisecondsToFrames(
        relativeSourceStart,
        input.source.framesPerSecond,
      ),
      transition: clip.transition,
      captions,
    });
    cursorMilliseconds = endMilliseconds;
  }

  return {
    timeline: {
      scenes,
      width: input.width,
      height: input.height,
      framesPerSecond: input.source.framesPerSecond,
      paddingMilliseconds: 0,
      totalDurationMilliseconds: cursorMilliseconds,
      totalFrames: millisecondsToFrames(
        cursorMilliseconds,
        input.source.framesPerSecond,
      ),
      captionCount: scenes.reduce(
        (total, scene) => total + scene.captions.length,
        0,
      ),
    },
    warnings,
  };
}
