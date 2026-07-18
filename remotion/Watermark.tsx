import { AbsoluteFill, useVideoConfig } from "remotion";

/**
 * Optional corner watermark burned into the export when a project requires
 * attribution. Renders nothing when no text is configured.
 */
export function Watermark({ text }: { text: string }) {
  const { height } = useVideoConfig();
  if (!text) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-end",
        padding: Math.round(height * 0.03),
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: Math.round(height * 0.028),
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.85)",
          textShadow: "0 1px 4px rgba(0, 0, 0, 0.6)",
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
}
