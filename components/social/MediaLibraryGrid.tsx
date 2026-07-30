"use client";

import { MediaAssetCard } from "@/components/social/MediaAssetCard";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function MediaLibraryGrid({
  assets,
  onSelect,
}: {
  assets: MediaAssetView[];
  onSelect: (asset: MediaAssetView) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => (
        <MediaAssetCard asset={asset} key={asset.id} onSelect={onSelect} />
      ))}
    </ul>
  );
}
