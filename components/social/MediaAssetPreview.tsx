/* eslint-disable @next/next/no-img-element */
import type { MediaAssetView } from "@/lib/media/media-asset-view";

/**
 * The visual for one library asset, on a checkered swatch so a transparent PNG
 * reads as transparent rather than as a white rectangle.
 *
 * Deliberately a plain `img`/`video` rather than `next/image`: these are
 * short-lived signed URLs on a private bucket, so there is nothing for the image
 * optimizer to cache and no configured remote pattern to match.
 */
export function MediaAssetPreview({
  asset,
  className,
}: {
  asset: MediaAssetView;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        "flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted"
      }
      style={{
        backgroundImage:
          "linear-gradient(45deg, rgb(0 0 0 / 0.06) 25%, transparent 25%), linear-gradient(-45deg, rgb(0 0 0 / 0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgb(0 0 0 / 0.06) 75%), linear-gradient(-45deg, transparent 75%, rgb(0 0 0 / 0.06) 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
      }}
    >
      {asset.kind === "image" ? (
        <img
          alt={asset.altText || asset.title}
          className="size-full object-contain"
          src={asset.previewUrl}
        />
      ) : (
        <video
          className="size-full object-contain"
          controls
          preload="metadata"
          src={asset.previewUrl}
        >
          <track kind="captions" />
        </video>
      )}
    </div>
  );
}
