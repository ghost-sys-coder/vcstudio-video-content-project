import { cn } from "@/lib/utils";
import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";

const POSITION_CLASS: Record<CaptionStyleData["position"], string> = {
  top: "items-start",
  middle: "items-center",
  bottom: "items-end",
};

/** The stage is a flex row, so the horizontal axis is the main one. */
const HORIZONTAL_CLASS: Record<CaptionStyleData["horizontalPosition"], string> =
  {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

/** Slide direction, matching the renderer's travel. */
const SLIDE_CLASS: Record<CaptionStyleData["entranceDirection"], string> = {
  top: "slide-in-from-top-4",
  bottom: "slide-in-from-bottom-4",
  left: "slide-in-from-left-4",
  right: "slide-in-from-right-4",
};

function withOpacity(hex: string, opacityPercent: number): string {
  const alpha = Math.round(
    (Math.min(100, Math.max(0, opacityPercent)) / 100) * 255,
  )
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

/**
 * Renders a representative caption using the configured style over a neutral
 * 16:9 stage, so editors can see color, size, weight, and placement decisions
 * before exporting or rendering.
 */
export function SubtitlePreview({
  captionStyle,
  sampleText,
}: {
  captionStyle: CaptionStyleData;
  sampleText: string;
}) {
  const text =
    sampleText.trim().length > 0 ? sampleText : "Caption preview text";
  const displayText = captionStyle.uppercase ? text.toUpperCase() : text;

  return (
    <div
      aria-label="Caption preview"
      className={cn(
        "flex overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-foreground/10",
        POSITION_CLASS[captionStyle.position],
        HORIZONTAL_CLASS[captionStyle.horizontalPosition],
      )}
      style={{ aspectRatio: "16 / 9", containerType: "size" }}
    >
      <div
        // Remounting on a settings change replays the entrance, so the effect
        // can be judged from the preview rather than only from a render.
        key={`${captionStyle.entranceEffect}-${captionStyle.entranceDirection}-${captionStyle.entranceDurationMilliseconds}`}
        className={cn(
          "max-w-[80%]",
          captionStyle.entranceEffect !== "none" && "animate-in fade-in",
          captionStyle.entranceEffect === "slide-fade" &&
            SLIDE_CLASS[captionStyle.entranceDirection],
        )}
        style={{
          padding: `${captionStyle.safeMarginPercent}%`,
          animationDuration:
            captionStyle.entranceEffect === "none"
              ? undefined
              : `${captionStyle.entranceDurationMilliseconds}ms`,
        }}
      >
        <span
          className="inline-block rounded-md text-center leading-tight"
          style={{
            backgroundColor:
              captionStyle.backgroundOpacityPercent > 0
                ? withOpacity(
                    captionStyle.backgroundColor,
                    captionStyle.backgroundOpacityPercent,
                  )
                : "transparent",
            color: captionStyle.primaryColor,
            fontFamily: captionStyle.fontFamily,
            fontSize: `${captionStyle.fontSizePercent}cqh`,
            fontWeight: captionStyle.bold ? 700 : 400,
            padding: "0.15em 0.4em",
            textShadow: `0 0 2px ${captionStyle.outlineColor}, 0 1px 2px ${captionStyle.outlineColor}`,
          }}
        >
          {displayText}
        </span>
      </div>
    </div>
  );
}
