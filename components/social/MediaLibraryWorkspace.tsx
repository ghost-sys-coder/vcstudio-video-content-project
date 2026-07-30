"use client";

import { useState } from "react";
import { EmptyMediaLibraryState } from "@/components/social/EmptyMediaLibraryState";
import { MediaAssetDetailSheet } from "@/components/social/MediaAssetDetailSheet";
import { MediaKindFilter } from "@/components/social/MediaKindFilter";
import { MediaLibraryGrid } from "@/components/social/MediaLibraryGrid";
import { MediaUploadDropzone } from "@/components/social/MediaUploadDropzone";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import type { MediaLibraryView } from "@/lib/media/load-media-library";

/**
 * The media library screen.
 *
 * Holds the asset list locally on top of the server-rendered page so an upload
 * appears immediately instead of waiting on a revalidation round trip — the
 * signed preview URL comes back from the completion response, so there is
 * nothing further to fetch.
 */
export function MediaLibraryWorkspace({
  canEdit,
  maxImageBytes,
  maxVideoBytes,
  view,
  workspaceId,
}: {
  canEdit: boolean;
  maxImageBytes: number;
  maxVideoBytes: number;
  view: MediaLibraryView;
  workspaceId: string;
}) {
  const [assets, setAssets] = useState<MediaAssetView[]>(view.assets);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  const hiddenCount = Math.max(view.total - assets.length, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Media library</h1>
          <p className="text-sm text-muted-foreground">
            Images and videos kept at workspace level, ready to attach to a
            post.
          </p>
        </div>
        <MediaKindFilter active={view.kind} />
      </header>

      {canEdit ? (
        <MediaUploadDropzone
          maxImageBytes={maxImageBytes}
          maxVideoBytes={maxVideoBytes}
          onUploaded={(uploaded) =>
            setAssets((current) => [
              // Only surface uploads that belong under the active filter, so a
              // video uploaded while filtering images does not appear to break it.
              ...uploaded.filter(
                (asset) => view.kind === null || asset.kind === view.kind,
              ),
              ...current,
            ])
          }
          workspaceId={workspaceId}
        />
      ) : null}

      {assets.length === 0 ? (
        <EmptyMediaLibraryState filtered={view.kind !== null} />
      ) : (
        <>
          <MediaLibraryGrid
            assets={assets}
            onSelect={(asset) => setSelectedId(asset.id)}
          />
          {hiddenCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              Showing the {assets.length} most recent of {view.total}.
            </p>
          ) : null}
        </>
      )}

      {/*
        Keyed on the asset so opening a different one remounts the form with its
        own values, rather than syncing props into state from an effect.
      */}
      {selected ? (
        <MediaAssetDetailSheet
          asset={selected}
          canEdit={canEdit}
          key={selected.id}
          onClose={() => setSelectedId(null)}
          onDeleted={(mediaAssetId) => {
            setAssets((current) =>
              current.filter((asset) => asset.id !== mediaAssetId),
            );
            setSelectedId(null);
          }}
          onUpdated={(updated) =>
            setAssets((current) =>
              current.map((asset) =>
                asset.id === updated.id ? updated : asset,
              ),
            )
          }
        />
      ) : null}
    </div>
  );
}
