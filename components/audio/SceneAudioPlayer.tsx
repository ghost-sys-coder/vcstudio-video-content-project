export function SceneAudioPlayer({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  return (
    <audio
      aria-label={label}
      className="h-9 w-full max-w-sm"
      controls
      preload="none"
      src={src}
    >
      Your browser does not support audio playback.
    </audio>
  );
}
