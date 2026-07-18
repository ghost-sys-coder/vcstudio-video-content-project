import { AbsoluteFill, Sequence } from "remotion";
import { CameraMotion } from "@/remotion/CameraMotion";
import { CaptionOverlay } from "@/remotion/CaptionOverlay";
import { SceneAudioTrack } from "@/remotion/SceneAudioTrack";
import { SceneImage } from "@/remotion/SceneImage";
import { SceneTransition } from "@/remotion/SceneTransition";
import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";
import type { VideoCompositionScene } from "@/lib/render/video-composition-data";

/**
 * Assembles one scene: the still under a camera move and entry transition, the
 * narration limited to its own length, and the caption overlay. Caption cues
 * are rebased to scene-relative frames because this component renders inside
 * the scene's Sequence.
 */
export function VideoScene({
  scene,
  visibleDurationFrames,
  captionStyle,
  includeCaptions,
}: {
  scene: VideoCompositionScene;
  visibleDurationFrames: number;
  captionStyle: CaptionStyleData;
  includeCaptions: boolean;
}) {
  const relativeCaptions = scene.captions.map((caption) => ({
    ...caption,
    startFrame: caption.startFrame - scene.startFrame,
    endFrame: caption.endFrame - scene.startFrame,
  }));

  return (
    <AbsoluteFill>
      <SceneTransition transition={scene.transition}>
        <CameraMotion
          motion={scene.cameraMotion}
          durationInFrames={visibleDurationFrames}
        >
          <SceneImage src={scene.imageUrl} />
        </CameraMotion>
      </SceneTransition>

      <Sequence durationInFrames={scene.durationFrames} name="Narration">
        <SceneAudioTrack src={scene.audioUrl} />
      </Sequence>

      {includeCaptions ? (
        <CaptionOverlay captions={relativeCaptions} style={captionStyle} />
      ) : null}
    </AbsoluteFill>
  );
}
