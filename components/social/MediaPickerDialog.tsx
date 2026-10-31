"use client";

import { useState } from "react";
import { ImagePlusIcon } from "lucide-react";
import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { useMediaLibraryPages } from "@/hooks/useMediaLibraryPages";
import { mergeMediaAssets } from "@/lib/media/merge-media-assets";

/**
 * Picks library media to attach to a post.
 *
 * Selection is multi-select and order-preserving: the order assets are picked in
 * is the order they are attached in, which is what an Instagram carousel or a
 * LinkedIn image set will show.
 */
export function MediaPickerDialog({
  attachedIds,
  recentAssets,
  onConfirm,
}: {
  attachedIds: string[];
  recentAssets: MediaAssetView[];
  onConfirm: (assets: MediaAssetView[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const pages = useMediaLibraryPages();
  const library = mergeMediaAssets(recentAssets, pages.assets);
  const available = library.filter((asset) => !attachedIds.includes(asset.id));

  function toggle(assetId: string) {
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSelectedIds([]);
          void pages.loadFirst();
        } else pages.cancel();
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <ImagePlusIcon />
        Attach media
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Attach from the media library</DialogTitle>
          <DialogDescription>
            Pick in the order you want them to appear. What you attach decides
            which platforms this post can go to.
          </DialogDescription>
        </DialogHeader>

        {pages.loading && !pages.loaded ? (
          <p role="status">Loading media…</p>
        ) : null}
        {pages.error ? (
          <div role="alert" className="space-y-2">
            <p>{pages.error}</p>
            <Button
              onClick={() => {
                void (pages.loaded ? pages.loadMore() : pages.loadFirst());
              }}
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </div>
        ) : null}
        {!pages.loaded ? null : available.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Nothing left to attach. Upload more in the media library.
          </p>
        ) : (
          <ul className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
            {available.map((asset) => {
              const order = selectedIds.indexOf(asset.id);
              return (
                <li key={asset.id}>
                  <button
                    aria-pressed={order >= 0}
                    className={`relative w-full space-y-1 rounded-lg border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      order >= 0
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => toggle(asset.id)}
                    type="button"
                  >
                    <MediaAssetPreview asset={asset} controls={false} />
                    <p className="truncate text-xs">{asset.title}</p>
                    {order >= 0 ? (
                      <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {order + 1}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {pages.nextCursor ? (
          <Button
            disabled={pages.loading}
            onClick={() => {
              void pages.loadMore();
            }}
            type="button"
            variant="outline"
          >
            {pages.loading ? "Loading…" : "Load more media"}
          </Button>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={
              <Button
                disabled={selectedIds.length === 0}
                onClick={() =>
                  onConfirm(
                    selectedIds
                      .map((id) => library.find((asset) => asset.id === id))
                      .filter((asset): asset is MediaAssetView =>
                        Boolean(asset),
                      ),
                  )
                }
              />
            }
          >
            Attach {selectedIds.length > 0 ? selectedIds.length : ""}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
