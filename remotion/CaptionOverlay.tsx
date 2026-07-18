import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { computeCaptionSafeArea } from "@/lib/render/caption-safe-area";
import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";
import type { RenderCaptionData } from "@/lib/render/render-timeline-snapshot";

function hexToRgba(hex: string, opacityPercent: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const alpha = Math.min(Math.max(opacityPercent, 0), 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function verticalAlignment(
  position: CaptionStyleData["position"],
): "flex-start" | "center" | "flex-end" {
  if (position === "top") return "flex-start";
  if (position === "middle") return "center";
  return "flex-end";
}

/**
 * Draws the single active caption cue for the current (scene-relative) frame,
 * inside the caption-safe rectangle. Cue frames are expected to already be
 * scene-relative so `useCurrentFrame` compares directly.
 */
export function CaptionOverlay({
  captions,
  style,
}: {
  captions: RenderCaptionData[];
  style: CaptionStyleData;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const active = captions.find(
    (caption) => frame >= caption.startFrame && frame < caption.endFrame,
  );
  if (!active) return null;

  const safe = computeCaptionSafeArea({
    width,
    height,
    safeMarginPercent: style.safeMarginPercent,
  });
  const fontSize = Math.round((height * style.fontSizePercent) / 100);
  const text = style.uppercase ? active.text.toUpperCase() : active.text;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: verticalAlignment(style.position),
        alignItems: "center",
        paddingTop: safe.marginYPixels,
        paddingBottom: safe.marginYPixels,
        paddingLeft: safe.marginXPixels,
        paddingRight: safe.marginXPixels,
      }}
    >
      <span
        style={{
          maxWidth: safe.safeWidthPixels,
          fontFamily: `${style.fontFamily}, sans-serif`,
          fontSize,
          fontWeight: style.bold ? 700 : 400,
          color: style.primaryColor,
          backgroundColor: hexToRgba(
            style.backgroundColor,
            style.backgroundOpacityPercent,
          ),
          padding: "0.2em 0.5em",
          borderRadius: 8,
          textAlign: "center",
          lineHeight: 1.25,
          textShadow: `0 2px 6px ${style.outlineColor}`,
          whiteSpace: "pre-line",
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
}
