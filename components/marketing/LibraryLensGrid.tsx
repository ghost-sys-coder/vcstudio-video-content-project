import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import { formatBytes } from "@/lib/format/bytes";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

/**
 * A read-only view of the workspace media library.
 *
 * Reuses `MediaAssetPreview` but not `MediaLibraryGrid`, whose cards are
 * buttons requiring an `onSelect`. Nothing here is selectable — the lens exists
 * so somebody tagging brand assets can see what is available, and a card that
 * looks clickable but is not would be worse than a plain one.
 */
export function LibraryLensGrid({ assets }: { assets: MediaAssetView[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => (
        <li className="space-y-1.5 rounded-xl border p-2" key={asset.id}>
          <MediaAssetPreview asset={asset} />
          <p className="truncate text-sm font-medium">
            {asset.title || asset.originalFileName}
          </p>
          <p className="text-xs text-muted-foreground">
            {asset.kind} · {formatBytes(asset.sizeBytes)}
          </p>
        </li>
      ))}
    </ul>
  );
}
