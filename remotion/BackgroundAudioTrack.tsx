import { Audio } from "remotion";

/**
 * Plays a sound bed under the whole video.
 *
 * Mounted once at the composition level rather than per scene, so it is
 * continuous across scene boundaries and does not restart every time the
 * picture changes.
 *
 * Volume is the creator's chosen fraction of the file's own level, and it is
 * applied flat rather than ducked under the narration. Ducking would need the
 * narration's envelope evaluated against this track frame by frame, and a bed
 * quiet enough to sit under speech does not need it; a bed loud enough to need
 * ducking is set too loud.
 */
export function BackgroundAudioTrack({
  loop,
  src,
  volume,
}: {
  loop: boolean;
  src: string;
  volume: number;
}) {
  return <Audio loop={loop} pauseWhenBuffering src={src} volume={volume} />;
}
