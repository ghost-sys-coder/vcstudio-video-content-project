import { Composition } from "remotion";
import {
  VideoComposition,
  type VideoCompositionProps,
} from "@/remotion/VideoComposition";
import { VIDEO_COMPOSITION_ID } from "@/lib/render/composition-id";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";

// Placeholder props for the Remotion Studio only. Every real preview and render
// supplies its own inputProps, so these values are never used to produce an
// export.
const DEFAULT_PROPS: VideoCompositionProps = {
  width: 1920,
  height: 1080,
  framesPerSecond: 30,
  durationInFrames: 60,
  includeCaptions: true,
  includeWatermark: false,
  watermarkText: "",
  captionStyle: DEFAULT_CAPTION_STYLE,
  scenes: [
    {
      sceneId: "00000000-0000-4000-8000-000000000000",
      sceneNumber: 1,
      startFrame: 0,
      durationFrames: 60,
      cameraMotion: "zoomIn",
      transition: "fade",
      imageUrl: "https://placehold.co/1920x1080",
      audioUrl: "https://placehold.co/audio.mp3",
      captions: [],
    },
  ],
};

/**
 * Registers the single video composition. Geometry and duration are derived
 * from the supplied props so one composition serves every aspect ratio and
 * length; the render worker selects it by {@link VIDEO_COMPOSITION_ID}.
 */
export function RemotionRoot() {
  return (
    <Composition
      id={VIDEO_COMPOSITION_ID}
      component={VideoComposition}
      durationInFrames={DEFAULT_PROPS.durationInFrames}
      fps={DEFAULT_PROPS.framesPerSecond}
      width={DEFAULT_PROPS.width}
      height={DEFAULT_PROPS.height}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.durationInFrames,
        fps: props.framesPerSecond,
        width: props.width,
        height: props.height,
      })}
    />
  );
}
