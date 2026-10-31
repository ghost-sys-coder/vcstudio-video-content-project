import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function mergeMediaAssets(
  ...pages: readonly MediaAssetView[][]
): MediaAssetView[] {
  const assets = new Map<string, MediaAssetView>();
  for (const page of pages)
    for (const asset of page) assets.set(asset.id, asset);
  return [...assets.values()];
}
