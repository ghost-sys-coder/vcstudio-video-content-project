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
}

export interface RenderSceneAudioData {
  objectKey: string;
  durationMilliseconds: number;
  format: string;
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
  audio: RenderSceneAudioData;
  captions: RenderCaptionData[];
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
