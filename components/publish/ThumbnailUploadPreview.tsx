"use client";

/**
 * Shows a chosen thumbnail inside the frame the platform will display it in,
 * before anything leaves the browser.
 *
 * The image is drawn contained rather than cropped, so a shape that does not
 * match the platform shows visible letterboxing instead of being silently
 * trimmed to look correct. The measurement reported here comes from the very
 * element being displayed, so what the creator sees and what gets validated
 * cannot disagree.
 */
export function ThumbnailUploadPreview({
  previewUrl,
  aspectRatio,
  platformLabel,
  onMeasured,
  onUnreadable,
}: {
  previewUrl: string;
  aspectRatio: number;
  platformLabel: string;
  onMeasured: (dimensions: { width: number; height: number }) => void;
  onUnreadable: () => void;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border bg-[repeating-conic-gradient(theme(colors.muted.DEFAULT)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
      style={{ aspectRatio: String(aspectRatio) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL for a file that has not been uploaded yet */}
      <img
        alt={`Preview of the ${platformLabel} thumbnail to upload`}
        className="absolute inset-0 h-full w-full object-contain"
        onError={onUnreadable}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0 && image.naturalHeight > 0)
            onMeasured({
              width: image.naturalWidth,
              height: image.naturalHeight,
            });
          else onUnreadable();
        }}
        src={previewUrl}
      />
    </div>
  );
}
