import "server-only";

import type { MediaAssetKind } from "@/db/schema";
import {
  countMediaAssets,
  listMediaAssetWindow,
} from "@/db/repositories/media-assets.repository";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import {
  toMediaAssetView,
  type MediaAssetView,
} from "@/lib/media/media-asset-view";
import {
  decodeLibraryCursor,
  encodeLibraryCursor,
} from "@/lib/media/library-cursor";
import { MEDIA_LIBRARY_PAGE_SIZE } from "@/lib/media/library-navigation";

export type MediaLibraryPageView = {
  assets: MediaAssetView[];
  pageSize: number;
  kind: MediaAssetKind | null;
  nextCursor?: string | null;
  previousCursor?: string | null;
};

export type MediaLibraryView = MediaLibraryPageView & { total: number };

type MediaLibraryInput = {
  workspaceId: string;
  kind?: MediaAssetKind;
  cursor?: string;
  visualOnly?: boolean;
};

/** The full library displays a total; pickers use the count-free page loader. */
export async function loadMediaLibrary(
  input: MediaLibraryInput,
): Promise<MediaLibraryView> {
  const [page, total] = await Promise.all([
    loadMediaLibraryPage(input),
    countMediaAssets({
      workspaceId: input.workspaceId,
      kind: input.kind,
      visualOnly: input.visualOnly,
    }),
  ]);
  return { ...page, total };
}

/**
 * Loads one page of the workspace media library with a signed preview URL per
 * asset.
 *
 * URLs are minted per request rather than stored, so they expire on their own
 * and a stale page cannot keep reading the bucket. Signing is done in parallel
 * because it is a local HMAC, not a network call — the cost is bounded by the
 * page size. The extra pagination sentinel is never signed or sent to the client.
 */
export async function loadMediaLibraryPage(
  input: MediaLibraryInput,
): Promise<MediaLibraryPageView> {
  const cursor = decodeLibraryCursor(input.cursor);
  const rows = await listMediaAssetWindow({
    workspaceId: input.workspaceId,
    kind: input.kind,
    cursor,
    visualOnly: input.visualOnly,
  });
  const hasMore = rows.length > MEDIA_LIBRARY_PAGE_SIZE;
  const assets = rows.slice(0, MEDIA_LIBRARY_PAGE_SIZE);
  if (cursor?.direction === "previous") assets.reverse();

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
    pageSize: MEDIA_LIBRARY_PAGE_SIZE,
    kind: input.kind ?? null,
    nextCursor:
      assets.length > 0 && (cursor?.direction === "previous" || hasMore)
        ? encodeLibraryCursor({
            id: assets[assets.length - 1]!.id,
            createdAt: assets[assets.length - 1]!.createdAt.toISOString(),
            direction: "next",
          })
        : assets.length === 0 && cursor?.direction === "previous"
          ? encodeLibraryCursor({ ...cursor, direction: "next" })
          : null,
    previousCursor:
      assets.length > 0 &&
      (cursor?.direction === "next" ||
        (cursor?.direction === "previous" && hasMore))
        ? encodeLibraryCursor({
            id: assets[0]!.id,
            createdAt: assets[0]!.createdAt.toISOString(),
            direction: "previous",
          })
        : assets.length === 0 && cursor?.direction === "next"
          ? encodeLibraryCursor({ ...cursor, direction: "previous" })
          : null,
  };
}
