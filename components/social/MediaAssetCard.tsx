"use client";

import { FilmIcon, ImageIcon } from "lucide-react";
import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/format/bytes";
import { formatDurationMs } from "@/lib/format/duration";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function MediaAssetCard({
  asset,
  onSelect,
}: {
  asset: MediaAssetView;
  onSelect: (asset: MediaAssetView) => void;
}) {
  const KindIcon = asset.kind === "video" ? FilmIcon : ImageIcon;
  const dimensions =
    asset.width && asset.height ? `${asset.width}×${asset.height}` : null;
  const duration =
    asset.durationMilliseconds !== null
      ? formatDurationMs(asset.durationMilliseconds)
      : null;

  return (
    <li>
      <button
        className="w-full space-y-2 rounded-xl border p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSelect(asset)}
        type="button"
      >
        <MediaAssetPreview asset={asset} />
        <div className="space-y-1 px-1 pb-1">
          <p className="truncate text-sm font-medium" title={asset.title}>
            {asset.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline">
              <KindIcon aria-hidden />
              {asset.kind === "video" ? "Video" : "Image"}
            </Badge>
            <span>{formatBytes(asset.sizeBytes)}</span>
            {dimensions ? <span>{dimensions}</span> : null}
            {duration ? <span>{duration}</span> : null}
          </div>
        </div>
      </button>
    </li>
  );
}
