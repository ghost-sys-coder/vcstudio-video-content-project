/* eslint-disable @next/next/no-img-element */
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { FilmIcon, Music2Icon } from "lucide-react";

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
  controls = true,
}: {
  asset: MediaAssetView;
  className?: string;
  controls?: boolean;
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
          decoding="async"
          loading="lazy"
          width={asset.width ?? undefined}
          height={asset.height ?? undefined}
          src={asset.previewUrl}
        />
      ) : !controls ? (
        <div
          aria-label={`${asset.kind === "audio" ? "Audio" : "Video"}: ${asset.title}`}
          className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"
          role="img"
        >
          {asset.kind === "audio" ? (
            <Music2Icon aria-hidden className="size-8" />
          ) : (
            <FilmIcon aria-hidden className="size-8" />
          )}
          <span className="text-xs">
            {asset.kind === "audio" ? "Audio" : "Video"}
          </span>
        </div>
      ) : asset.kind === "audio" ? (
        <audio
          aria-label={asset.title}
          className="w-full"
          controls
          preload="none"
          src={asset.previewUrl}
        />
      ) : (
        <video
          className="size-full object-contain"
          controls={controls}
          preload="none"
          src={asset.previewUrl}
        >
          <track kind="captions" />
        </video>
      )}
    </div>
  );
}
