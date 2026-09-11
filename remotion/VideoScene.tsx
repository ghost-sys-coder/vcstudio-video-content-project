import { AbsoluteFill, Sequence } from "remotion";
import { CameraMotion } from "@/remotion/CameraMotion";
import { CaptionOverlay } from "@/remotion/CaptionOverlay";
import {
  NarrationLevelMeter,
  type NarrationLevelMeterPosition,
} from "@/remotion/NarrationLevelMeter";
import { CharacterSpriteLayer } from "@/remotion/CharacterSpriteLayer";
import { SceneAudioTrack } from "@/remotion/SceneAudioTrack";
import { SceneImage } from "@/remotion/SceneImage";
import { SceneShotSequence } from "@/remotion/SceneShotSequence";
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
  levelMeterPosition,
}: {
  scene: VideoCompositionScene;
  visibleDurationFrames: number;
  captionStyle: CaptionStyleData;
  includeCaptions: boolean;
  /** Absent when this project does not draw a meter. */
  levelMeterPosition?: NarrationLevelMeterPosition;
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
          {/* A scene that changes image partway through draws its own
              stack; every other scene is one still, exactly as before. */}
          {scene.shots?.length ? (
            <SceneShotSequence sceneId={scene.sceneId} shots={scene.shots} />
          ) : (
            <SceneImage
              framing={scene.imageFraming}
              src={scene.imageUrl}
              sceneId={scene.sceneId}
            />
          )}
        </CameraMotion>
        {/* Over the plate but inside the transition, so a character fades in
            with its scene rather than popping. */}
        {scene.characters?.length ? (
          <CharacterSpriteLayer
            characters={scene.characters}
            sceneId={scene.sceneId}
          />
        ) : null}
      </SceneTransition>

      <Sequence durationInFrames={scene.durationFrames} name="Narration">
        <SceneAudioTrack
          src={scene.audioUrl}
          trimBeforeFrames={scene.audioTrimBeforeFrames}
        />
      </Sequence>

      {includeCaptions ? (
        <CaptionOverlay captions={relativeCaptions} style={captionStyle} />
      ) : null}

      {/* Inside the scene, because the envelope it reads is this scene's own
          narration and its frames are scene-relative. */}
      {levelMeterPosition && scene.narrationEnvelope?.length ? (
        <NarrationLevelMeter
          envelope={scene.narrationEnvelope}
          position={levelMeterPosition}
        />
      ) : null}
    </AbsoluteFill>
  );
}
