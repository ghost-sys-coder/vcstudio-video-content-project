import { AbsoluteFill, useVideoConfig } from "remotion";
import { computeCaptionSafeArea } from "@/lib/render/caption-safe-area";

/**
 * Preview-only overlay outlining the caption-safe rectangle. It is never
 * enabled during an actual render, so it is never burned into an export; it
 * only helps reviewers see where captions and key content stay clear of the
 * frame edge.
 */
export function SafeAreaGuides({
  safeMarginPercent,
}: {
  safeMarginPercent: number;
}) {
  const { width, height } = useVideoConfig();
  const safe = computeCaptionSafeArea({ width, height, safeMarginPercent });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: safe.marginYPixels,
          left: safe.marginXPixels,
          width: safe.safeWidthPixels,
          height: safe.safeHeightPixels,
          border: "2px dashed rgba(255, 255, 255, 0.5)",
          boxSizing: "border-box",
        }}
      />
    </AbsoluteFill>
  );
}
