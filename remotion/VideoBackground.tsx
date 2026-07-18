import { AbsoluteFill } from "remotion";

/**
 * Solid backing layer behind every scene. It fills the brief inter-scene
 * padding gaps and any letterboxing so the composition never flashes a
 * transparent frame.
 */
export function VideoBackground({ color = "#000000" }: { color?: string }) {
  return <AbsoluteFill style={{ backgroundColor: color }} />;
}
