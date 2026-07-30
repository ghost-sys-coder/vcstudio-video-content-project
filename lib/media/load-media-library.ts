import "server-only";

import type { MediaAssetKind } from "@/db/schema";
import {
  countMediaAssets,
  listMediaAssets,
  MEDIA_ASSET_PAGE_SIZE,
} from "@/db/repositories/media-assets.repository";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import {
  toMediaAssetView,
  type MediaAssetView,
} from "@/lib/media/media-asset-view";

export type MediaLibraryView = {
  assets: MediaAssetView[];
  total: number;
  pageSize: number;
  kind: MediaAssetKind | null;
};

/**
 * Loads one page of the workspace media library with a signed preview URL per
 * asset.
 *
 * URLs are minted per request rather than stored, so they expire on their own
 * and a stale page cannot keep reading the bucket. Signing is done in parallel
 * because it is a local HMAC, not a network call — the cost is bounded by the
 * page size, which is why `listMediaAssets` caps it.
 */
export async function loadMediaLibrary(input: {
  workspaceId: string;
  kind?: MediaAssetKind;
  offset?: number;
}): Promise<MediaLibraryView> {
  const [assets, total] = await Promise.all([
    listMediaAssets({
      workspaceId: input.workspaceId,
      kind: input.kind,
      offset: input.offset,
    }),
    countMediaAssets({ workspaceId: input.workspaceId, kind: input.kind }),
  ]);

  const views = await Promise.all(
    assets.map(async (asset) =>
      toMediaAssetView(
        asset,
        await createMediaAssetDownloadUrl(asset.objectKey),
      ),
    ),
  );

  return {
    assets: views,
    total,
    pageSize: MEDIA_ASSET_PAGE_SIZE,
    kind: input.kind ?? null,
  };
}
