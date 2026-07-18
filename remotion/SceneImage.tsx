import { AbsoluteFill, Img } from "remotion";

/**
 * Renders a scene's approved still, cover-fitted to the frame so it fills the
 * output at any supported aspect ratio without distortion.
 */
export function SceneImage({ src }: { src: string }) {
  return (
    <AbsoluteFill>
      <Img
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
}
