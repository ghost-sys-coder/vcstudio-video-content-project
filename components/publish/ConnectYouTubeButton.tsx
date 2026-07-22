import { YouTubeMarkIcon } from "@/components/brand/YouTubeMarkIcon";
import { cn } from "@/lib/utils";

/**
 * Branded connect action for the YouTube OAuth flow.
 *
 * Uses `#e60000` rather than YouTube's `#ff0000`: white on pure red is only a
 * 3.99:1 contrast ratio, which fails WCAG AA for normal-size text, while this
 * shade reads as the same brand red at 4.81:1. The red is fixed in both themes
 * — a brand colour that flips with the site theme stops reading as the brand.
 *
 * A plain anchor, not a button: the OAuth flow is a full-page navigation to
 * Google, so it must behave like a link (middle-click, open in new tab).
 */
export function ConnectYouTubeButton({
  className,
  label = "Connect a YouTube channel",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg px-5 py-2.5",
        "bg-[#e60000] text-sm font-semibold text-white",
        "shadow-sm transition-colors",
        "hover:bg-[#cc0000] active:bg-[#b30000]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e60000] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      href="/api/youtube/authorize"
    >
      <YouTubeMarkIcon className="size-5 shrink-0" />
      {label}
    </a>
  );
}
