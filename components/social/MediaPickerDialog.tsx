"use client";

import { useRef, useState } from "react";
import { ImagePlusIcon, Loader2Icon } from "lucide-react";
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

export type MediaPickerSaveResult = { ok: true } | { ok: false; error: string };

/**
 * Picks library media to attach to a post.
 *
 * Selection is multi-select and order-preserving: the order assets are picked in
 * is the order they are attached in, which is what an Instagram carousel or a
 * LinkedIn image set will show.
 */
export function MediaPickerDialog({
  attachedIds,
  disabled = false,
  recentAssets,
  onConfirm,
  kind,
  selectionLimit,
  triggerLabel = "Attach media",
  title = "Attach from the media library",
  description = "Select images or videos in the order you want them to appear, then save them to this post.",
  confirmLabel = "Save to post",
  confirmDescription = "Saves your selection and current draft changes.",
}: {
  attachedIds: string[];
  disabled?: boolean;
  recentAssets: MediaAssetView[];
  onConfirm: (assets: MediaAssetView[]) => Promise<MediaPickerSaveResult>;
  kind?: "image" | "video";
  selectionLimit?: 1;
  triggerLabel?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmDescription?: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveInFlight = useRef(false);
  const pages = useMediaLibraryPages(kind);
  const library = mergeMediaAssets(recentAssets, pages.assets);
  const available = library.filter(
    (asset) =>
      !attachedIds.includes(asset.id) && (!kind || asset.kind === kind),
  );

  function toggle(assetId: string) {
    if (saveInFlight.current) return;
    setSaveError(null);
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : selectionLimit === 1
          ? [assetId]
          : [...current, assetId],
    );
  }

  async function saveSelection() {
    if (saveInFlight.current || selectedIds.length === 0) return;
    const assets = selectedIds.flatMap((id) => {
      const asset = library.find((item) => item.id === id);
      return asset ? [asset] : [];
    });
    if (assets.length !== selectedIds.length) {
      setSaveError(
        "Some selected media is no longer available. Reopen the library and select it again.",
      );
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await onConfirm(assets);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setOpen(false);
      setSelectedIds([]);
      pages.cancel();
    } catch {
      setSaveError(
        "The media could not be saved to this post. Your selection is still here; try again.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (saveInFlight.current) return;
        setOpen(nextOpen);
        if (nextOpen) {
          setSelectedIds([]);
          setSaveError(null);
          void pages.loadFirst();
        } else pages.cancel();
      }}
    >
      <DialogTrigger
        disabled={disabled}
        render={<Button size="sm" variant="outline" />}
      >
        <ImagePlusIcon />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent
        className="flex flex-col overflow-hidden sm:max-w-3xl"
        showCloseButton={!saving}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto space-y-3">
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
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {available.map((asset) => {
                const order = selectedIds.indexOf(asset.id);
                return (
                  <li key={asset.id}>
                    <button
                      aria-label={asset.title}
                      aria-pressed={order >= 0}
                      disabled={saving}
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
              disabled={pages.loading || saving}
              onClick={() => {
                void pages.loadMore();
              }}
              type="button"
              variant="outline"
            >
              {pages.loading ? "Loading…" : "Load more media"}
            </Button>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-col sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p role="status" aria-live="polite" className="font-medium">
              {saving
                ? "Saving media to this post…"
                : selectedIds.length > 0
                  ? `${selectedIds.length} ${selectedIds.length === 1 ? "file" : "files"} selected`
                  : "Select media to attach"}
            </p>
            <p className="text-xs text-muted-foreground">
              {confirmDescription}
            </p>
            {saveError ? (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <DialogClose
              disabled={saving}
              render={<Button type="button" variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button
              disabled={selectedIds.length === 0 || saving}
              onClick={() => void saveSelection()}
              type="button"
            >
              {saving ? (
                <Loader2Icon aria-hidden className="animate-spin" />
              ) : null}
              {saving
                ? "Saving…"
                : `${confirmLabel}${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
