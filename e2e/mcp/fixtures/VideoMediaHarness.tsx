import { useState } from "react";
import { MediaAssetCard } from "@/components/social/MediaAssetCard";
import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import { VideoThumbnailAction } from "@/components/social/VideoThumbnailAction";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { legacyVideo, thumbnailVideo } from "./video-thumbnail-data";
export function VideoMediaHarness() {
  const [assets, setAssets] = useState([thumbnailVideo, legacyVideo]);
  const [selected, setSelected] = useState<MediaAssetView | null>(null);
  return (
    <main className="app-page mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Media library</h1>
      <ul className="app-grid grid-cols-2">
        {assets.map((asset) => (
          <MediaAssetCard key={asset.id} asset={asset} onSelect={setSelected} />
        ))}
      </ul>
      {selected ? (
        <section
          aria-label="Video details"
          className="app-panel app-section rounded-xl border bg-card"
        >
          <h2>{selected.title}</h2>
          <MediaAssetPreview
            asset={selected}
            className="flex aspect-video max-h-80 items-center justify-center overflow-hidden rounded-lg border bg-muted"
          />
          <VideoThumbnailAction
            key={selected.id}
            asset={selected}
            onUpdated={(asset) => {
              setSelected(asset);
              setAssets((current) =>
                current.map((item) => (item.id === asset.id ? asset : item)),
              );
            }}
          />
        </section>
      ) : null}
    </main>
  );
}
