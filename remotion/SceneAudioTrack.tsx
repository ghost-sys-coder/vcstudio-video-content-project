import { Audio } from "remotion";

/**
 * Plays a scene's approved narration. It is mounted inside a fixed-length
 * Sequence by the parent so playback stops at the narration's measured
 * duration even when the visible still is held longer to cover padding.
 *
 * `pauseWhenBuffering` opts this track into Remotion's buffer state so, in the
 * preview, playback pauses (rather than skips) whenever the audio has not
 * buffered enough to play the current frame.
 */
export function SceneAudioTrack({ src }: { src: string }) {
  return <Audio src={src} pauseWhenBuffering />;
}
