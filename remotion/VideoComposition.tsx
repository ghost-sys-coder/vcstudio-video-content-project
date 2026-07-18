import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { SafeAreaGuides } from "@/remotion/SafeAreaGuides";
import { VideoBackground } from "@/remotion/VideoBackground";
import { VideoScene } from "@/remotion/VideoScene";
import { Watermark } from "@/remotion/Watermark";
import type { VideoCompositionInput } from "@/lib/render/video-composition-data";

/**
 * How far ahead of its start each scene is premounted. This mounts (and starts
 * loading/decoding) the incoming scene before its fade begins, so both the
 * outgoing and incoming scenes exist during the transition overlap and the cut
 * never lands on an undecoded still.
 */
const PREMOUNT_SECONDS = 1.5;

/**
 * `showSafeAreaGuides` is a preview-only flag; it is never set on the validated
 * render input, so guides are never burned into an export.
 */
export type VideoCompositionProps = VideoCompositionInput & {
  showSafeAreaGuides?: boolean;
};

/**
 * The single registered composition. It lays every scene onto its absolute
 * frame slot over a persistent background, holding each still until the next
 * scene begins so the brief inter-scene padding never shows a black gap, then
 * overlays the optional watermark and preview safe-area guides.
 */
export function VideoComposition({
  scenes,
  includeCaptions,
  includeWatermark,
  watermarkText,
  captionStyle,
  showSafeAreaGuides = false,
}: VideoCompositionProps) {
  const { fps } = useVideoConfig();
  const premountFrames = Math.round(fps * PREMOUNT_SECONDS);

  return (
    <AbsoluteFill>
      <VideoBackground />

      {scenes.map((scene, index) => {
        const next = scenes[index + 1];
        const gapAwareDuration = next
          ? next.startFrame - scene.startFrame
          : scene.durationFrames;
        const visibleDurationFrames = Math.max(
          gapAwareDuration,
          scene.durationFrames,
        );

        return (
          <Sequence
            key={scene.sceneId}
            from={scene.startFrame}
            durationInFrames={visibleDurationFrames}
            premountFor={index === 0 ? 0 : premountFrames}
            name={`Scene ${scene.sceneNumber}`}
          >
            <VideoScene
              scene={scene}
              visibleDurationFrames={visibleDurationFrames}
              captionStyle={captionStyle}
              includeCaptions={includeCaptions}
            />
          </Sequence>
        );
      })}

      {includeWatermark ? <Watermark text={watermarkText} /> : null}
      {showSafeAreaGuides ? (
        <SafeAreaGuides safeMarginPercent={captionStyle.safeMarginPercent} />
      ) : null}
    </AbsoluteFill>
  );
}
