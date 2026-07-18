import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";
import type {
  RenderCameraMotion,
  RenderCaptionData,
  RenderSceneTransition,
} from "@/lib/render/render-timeline-snapshot";

/**
 * The fully-resolved props passed into the Remotion composition. It differs
 * from the persisted {@link RenderTimelineSnapshot} in that R2 object keys have
 * been resolved to short-lived signed URLs the browser/renderer can fetch.
 *
 * These are pure type declarations (no runtime imports) so the Remotion
 * components can share them in both the browser preview (via @remotion/player)
 * and the render worker bundle without pulling in server-only code.
 */
export type VideoCompositionScene = {
  sceneId: string;
  sceneNumber: number;
  startFrame: number;
  durationFrames: number;
  cameraMotion: RenderCameraMotion;
  transition: RenderSceneTransition;
  imageUrl: string;
  audioUrl: string;
  captions: RenderCaptionData[];
};

// A type alias (not an interface) so it satisfies `Record<string, unknown>`,
// which Remotion's Composition requires of its props type.
export type VideoCompositionInput = {
  width: number;
  height: number;
  framesPerSecond: number;
  durationInFrames: number;
  includeCaptions: boolean;
  includeWatermark: boolean;
  watermarkText: string;
  captionStyle: CaptionStyleData;
  scenes: VideoCompositionScene[];
};
