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
/**
 * One animated character to draw over the scene's background plate, with pose
 * object keys already resolved to signed URLs and the amplitude envelope
 * already resampled to one value per frame of this scene.
 */
export type VideoCompositionSceneCharacter = {
  characterId: string;
  stageSlot: "left" | "center" | "right";
  isSpeaker: boolean;
  /** Mirrors the sprite horizontally so characters face each other. */
  faceLeft: boolean;
  idleUrl: string;
  talkOpenUrl: string;
  talkClosedUrl: string;
  blinkUrl: string;
  /** Empty for non-speakers and when no envelope was measured. */
  amplitudeEnvelope: number[];
};

/**
 * One still within a multi-image scene, with its object key already resolved
 * to a signed URL and its frames relative to the scene's own start.
 */
export type VideoCompositionSceneShot = {
  imageUrl: string;
  framing?: {
    mode: "cover" | "contain" | "outpaint";
    focalPointXBps: number;
    focalPointYBps: number;
    scaleBps: number;
    backgroundColor: string;
  };
  startFrame: number;
  endFrame: number;
};

export type VideoCompositionScene = {
  sceneId: string;
  sceneNumber: number;
  startFrame: number;
  durationFrames: number;
  cameraMotion: RenderCameraMotion;
  transition: RenderSceneTransition;
  imageUrl: string;
  imageFraming?: {
    mode: "cover" | "contain" | "outpaint";
    focalPointXBps: number;
    focalPointYBps: number;
    scaleBps: number;
    backgroundColor: string;
  };
  /**
   * Present only when the scene holds more than one image. Absent for every
   * single-image scene, which renders through `imageUrl` exactly as before.
   */
  shots?: VideoCompositionSceneShot[];
  audioUrl: string;
  audioTrimBeforeFrames?: number;
  captions: RenderCaptionData[];
  /** Absent for static-image projects. */
  characters?: VideoCompositionSceneCharacter[];
  /**
   * The narration's loudness, one value per frame of this scene, 0..1. Present
   * only when this project draws a level meter.
   */
  narrationEnvelope?: number[];
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
  /** Present only when this project has a sound bed. */
  backgroundAudio?: {
    url: string;
    /** 0..1, already converted from the stored percent. */
    volume: number;
    loop: boolean;
  };
  /** Present only when the level meter is switched on. */
  levelMeter?: {
    position:
      | "bottomLeft"
      | "bottomCenter"
      | "bottomRight"
      | "topLeft"
      | "topCenter"
      | "topRight";
  };
};
