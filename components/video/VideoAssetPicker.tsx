"use client";
import { useState } from "react";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { useMediaLibraryPages } from "@/hooks/useMediaLibraryPages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
export function VideoAssetPicker({
  kind = "image",
  onSelect,
  disabled = false,
}: {
  kind?: "image" | "video";
  onSelect: (asset: MediaAssetView) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const library = useMediaLibraryPages(kind);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) void library.loadFirst();
        else library.cancel();
      }}
    >
      <DialogTrigger
        disabled={disabled}
        render={<Button type="button" variant="outline" />}
      >
        <ImagePlus className="size-4" />
        Choose {kind}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a library {kind}</DialogTitle>
          <DialogDescription>
            Use an existing workspace asset. Upload new files in the media
            library.
          </DialogDescription>
        </DialogHeader>
        {library.error ? (
          <p role="alert" className="text-destructive">
            {library.error}
          </p>
        ) : null}
        {library.loading ? (
          <p role="status" className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" />
            Loading library…
          </p>
        ) : null}
        <div className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
          {library.assets.map((asset) => (
            <Button
              key={asset.id}
              variant="ghost"
              className="h-auto min-w-0 flex-col items-stretch rounded-2xl p-2"
              onClick={() => {
                onSelect(asset);
                setOpen(false);
                library.cancel();
              }}
            >
              <MediaAssetPreview asset={asset} controls={false} />
              <span className="w-full truncate text-left text-xs">
                {asset.title}
              </span>
            </Button>
          ))}
        </div>
        {!library.loading && !library.assets.length ? (
          <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">
            No ready {kind}s in this workspace yet.
          </p>
        ) : null}
        {library.error ? (
          <Button variant="outline" onClick={() => void library.loadFirst()}>
            Try again
          </Button>
        ) : null}
        {library.nextCursor ? (
          <Button
            disabled={library.loading}
            variant="outline"
            onClick={() => void library.loadMore()}
          >
            Load more
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
