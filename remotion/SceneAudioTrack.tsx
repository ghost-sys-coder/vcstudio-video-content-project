import { Audio } from "remotion";

/**
 * Plays a scene's approved narration. It is mounted inside a fixed-length
 * Sequence by the parent so playback stops at the narration's measured
 * duration even when the visible still is held longer to cover padding.
 */
export function SceneAudioTrack({ src }: { src: string }) {
  return <Audio src={src} />;
}
