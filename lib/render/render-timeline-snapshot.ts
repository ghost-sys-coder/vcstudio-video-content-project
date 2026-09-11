/**
 * Zero-import, dependency-free serializable timeline persisted on the
 * `video_renders` row and passed verbatim to the Remotion composition.
 *
 * The snapshot freezes the exact geometry, timing, motion, transitions, and
 * caption cues resolved when the render was requested, so a render reproduces
 * even if scenes, audio, or subtitle settings change afterwards. It stores R2
 * object keys — never signed URLs — which the render worker resolves to
 * short-lived signed URLs at render time.
 *
 * This module only imports the dependency-free caption-style type, so it can be
 * referenced from `db/schema.ts` (via `import type`) without creating an import
 * cycle, matching the caption-style-data pattern.
 */

import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";

export type RenderCameraMotion =
  "none" | "zoomIn" | "zoomOut" | "panLeft" | "panRight" | "panUp" | "panDown";

export type RenderSceneTransition = "cut" | "fade";

export interface RenderCaptionData {
  text: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
}

export interface RenderSceneImageData {
  objectKey: string;
  width: number | null;
  height: number | null;
  framing?: {
    mode: "cover" | "contain" | "outpaint";
    focalPointXBps: number;
    focalPointYBps: number;
    scaleBps: number;
    backgroundColor: string;
  };
}

/**
 * One still within a multi-image scene, with its frames already resolved
 * relative to the scene's own start.
 *
 * Frozen into the snapshot like everything else here, so a render reproduces
 * even after the scene's images, captions or narration change. Scene-relative
 * frames rather than project-absolute ones, because the Remotion component
 * renders inside the scene's own Sequence and an earlier scene changing length
 * must not move these.
 */
export interface RenderSceneShotData {
  objectKey: string;
  width: number | null;
  height: number | null;
  framing?: {
    mode: "cover" | "contain" | "outpaint";
    focalPointXBps: number;
    focalPointYBps: number;
    scaleBps: number;
    backgroundColor: string;
  };
  startFrame: number;
  endFrame: number;
  /**
   * Whether this shot begins where a caption line begins. False means it was
   * placed by even division because no caption boundary was usable, and the
   * change does not follow the narration.
   */
  startedOnCueBoundary: boolean;
}

export interface RenderSceneAudioData {
  objectKey: string;
  durationMilliseconds: number;
  format: string;
  trimBeforeFrames?: number;
}

export type RenderSceneCharacterStageSlot = "left" | "center" | "right";

/**
 * One animated character standing in a scene, frozen at render request time.
 *
 * Pose object keys are stored rather than URLs (matching image/audio) so a
 * render stays reproducible and the worker signs them itself. Only the speaking
 * character carries an amplitude envelope; the rest idle and blink.
 */
export interface RenderSceneCharacterData {
  characterId: string;
  name: string;
  stageSlot: RenderSceneCharacterStageSlot;
  isSpeaker: boolean;
  poses: {
    idle: string;
    talkOpen: string;
    talkClosed: string;
    blink: string;
  };
  amplitudeEnvelope?: number[];
  amplitudeSampleRateHz?: number;
}

export interface RenderSceneData {
  sceneId: string;
  sceneNumber: number;
  startMilliseconds: number;
  endMilliseconds: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  cameraMotion: RenderCameraMotion;
  transition: RenderSceneTransition;
  image: RenderSceneImageData;
  /**
   * Present only when the scene holds more than one image. Absent, not empty,
   * for every single-image scene — so an existing render's frozen snapshot is
   * byte-identical to what it was before multi-image scenes existed, and
   * re-rendering it produces the same video.
   *
   * When present, the first entry corresponds to `image` above, which stays
   * populated so any consumer that does not understand shots still shows the
   * scene's representative still rather than nothing.
   */
  shots?: RenderSceneShotData[];
  audio: RenderSceneAudioData;
  captions: RenderCaptionData[];
  /**
   * Present only for animated projects. Absent (not empty) for static-image
   * projects, so an existing render's frozen snapshot is unchanged.
   */
  characters?: RenderSceneCharacterData[];
}

export interface RenderTimelineSnapshot {
  width: number;
  height: number;
  framesPerSecond: number;
  totalDurationMilliseconds: number;
  totalFrames: number;
  includeCaptions: boolean;
  includeWatermark: boolean;
  captionStyle: CaptionStyleData;
  scenes: RenderSceneData[];
}
