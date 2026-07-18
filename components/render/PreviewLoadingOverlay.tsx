import { Loader2Icon, PlayIcon } from "lucide-react";

/**
 * Covers the preview while its initial asset window loads. It shows an explicit
 * "Loading preview" state with progress and a disabled play control, so
 * playback can never be started before the first assets and fonts are ready —
 * the root cause of the first-play stutter.
 */
export function PreviewLoadingOverlay({
  loadedCount,
  totalCount,
}: {
  loadedCount: number;
  totalCount: number;
}) {
  const label =
    totalCount > 0
      ? `Loading preview… ${loadedCount}/${totalCount}`
      : "Loading preview…";

  return (
    <div
      aria-live="polite"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-white"
      role="status"
    >
      <button
        aria-label="Play (loading preview)"
        className="flex size-12 items-center justify-center rounded-full border border-white/30 text-white/50"
        disabled
        type="button"
      >
        <PlayIcon aria-hidden className="size-6" />
      </button>
      <div className="flex items-center gap-2 text-sm">
        <Loader2Icon aria-hidden className="size-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}
