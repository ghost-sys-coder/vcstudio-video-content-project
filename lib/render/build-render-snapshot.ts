import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";
import type { VideoTimeline } from "@/lib/timeline/video-timeline";
import {
  deriveSceneCameraMotion,
  deriveSceneTransition,
} from "@/lib/render/scene-motion";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";

/**
 * Freezes a ready {@link VideoTimeline} into the serializable render snapshot,
 * assigning each scene its deterministic camera move and transition. Shared by
 * the render dispatcher and the live preview so both show exactly the same
 * motion, timing, and captions.
 */
export function buildRenderTimelineSnapshot(input: {
  timeline: VideoTimeline;
  captionStyle: CaptionStyleData;
  includeCaptions: boolean;
  includeWatermark: boolean;
}): RenderTimelineSnapshot {
  const { timeline } = input;
  return {
    width: timeline.width,
    height: timeline.height,
    framesPerSecond: timeline.framesPerSecond,
    totalDurationMilliseconds: timeline.totalDurationMilliseconds,
    totalFrames: timeline.totalFrames,
    includeCaptions: input.includeCaptions,
    includeWatermark: input.includeWatermark,
    captionStyle: input.captionStyle,
    scenes: timeline.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      startMilliseconds: scene.startMilliseconds,
      endMilliseconds: scene.endMilliseconds,
      startFrame: scene.startFrame,
      endFrame: scene.endFrame,
      durationFrames: scene.durationFrames,
      cameraMotion: deriveSceneCameraMotion(scene.sceneNumber),
      transition: deriveSceneTransition(scene.sceneNumber),
      image: {
        objectKey: scene.image.objectKey,
        width: scene.image.width,
        height: scene.image.height,
      },
      audio: {
        objectKey: scene.audio.objectKey,
        // A ready timeline guarantees a measured duration; the scene slot
        // equals the audio length, so it is an exact, non-null fallback.
        durationMilliseconds:
          scene.audio.durationMilliseconds ?? scene.durationMilliseconds,
        format: scene.audio.format,
      },
      captions: input.includeCaptions
        ? scene.captions.map((caption) => ({
            text: caption.text,
            startMs: caption.startMs,
            endMs: caption.endMs,
            startFrame: caption.startFrame,
            endFrame: caption.endFrame,
          }))
        : [],
    })),
  };
}
