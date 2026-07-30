"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { updateMediaAssetAction } from "@/app/(authenticated)/app/social/actions";
import { MediaAssetDeleteDialog } from "@/components/social/MediaAssetDeleteDialog";
import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/format/bytes";
import { formatDurationMs } from "@/lib/format/duration";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import {
  MAX_MEDIA_ALT_TEXT_LENGTH,
  MAX_MEDIA_TITLE_LENGTH,
} from "@/lib/schemas/media-asset";

/**
 * Detail and edit panel for a single library asset.
 *
 * Alt text is a first-class field rather than an afterthought: LinkedIn and
 * Facebook both accept it, and it is the only accessibility control the composer
 * can offer for an image once it has been posted.
 *
 * The caller mounts this only when an asset is open and keys it on the asset id,
 * so the form initialises from props once instead of syncing them in an effect.
 */
export function MediaAssetDetailSheet({
  asset,
  canEdit,
  onClose,
  onDeleted,
  onUpdated,
}: {
  asset: MediaAssetView;
  canEdit: boolean;
  onClose: () => void;
  onDeleted: (mediaAssetId: string) => void;
  onUpdated: (asset: MediaAssetView) => void;
}) {
  const [title, setTitle] = useState(asset.title);
  const [altText, setAltText] = useState(asset.altText);
  const [tagsText, setTagsText] = useState(asset.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const data = new FormData();
      data.set("mediaAssetId", asset.id);
      data.set("title", title);
      data.set("altText", altText);
      for (const tag of tagsText.split(",")) {
        const trimmed = tag.trim();
        if (trimmed !== "") data.append("tags", trimmed);
      }
      const result = await updateMediaAssetAction(data);
      if (result.ok) {
        onUpdated(result.asset);
        setSaved(true);
      } else setError(result.error);
    });
  }

  const dimensions =
    asset.width && asset.height ? `${asset.width}×${asset.height}` : null;

  return (
    <Sheet onOpenChange={(open) => (open ? undefined : onClose())} open>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{asset.title}</SheetTitle>
          <SheetDescription>
            {asset.kind === "video" ? "Video" : "Image"} ·{" "}
            {formatBytes(asset.sizeBytes)}
            {dimensions ? ` · ${dimensions}` : ""}
            {asset.durationMilliseconds !== null
              ? ` · ${formatDurationMs(asset.durationMilliseconds)}`
              : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <MediaAssetPreview
            asset={asset}
            className="flex max-h-64 items-center justify-center overflow-hidden rounded-lg border bg-muted"
          />

          <div className="space-y-2">
            <Label htmlFor="media-title">Title</Label>
            <Input
              disabled={!canEdit || pending}
              id="media-title"
              maxLength={MAX_MEDIA_TITLE_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="media-alt-text">Alt text</Label>
            <Textarea
              disabled={!canEdit || pending}
              id="media-alt-text"
              maxLength={MAX_MEDIA_ALT_TEXT_LENGTH}
              onChange={(event) => setAltText(event.target.value)}
              rows={3}
              value={altText}
            />
            <p className="text-xs text-muted-foreground">
              Describes the media for people using a screen reader. Carried
              through to platforms that accept it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="media-tags">Tags</Label>
            <Input
              disabled={!canEdit || pending}
              id="media-tags"
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="product, launch, behind the scenes"
              value={tagsText}
            />
            <p className="text-xs text-muted-foreground">
              Comma separated. Used to find this again in a large library.
            </p>
          </div>

          <p aria-live="polite" className="text-sm">
            {error ? <span className="text-destructive">{error}</span> : null}
            {saved && !error ? (
              <span className="text-muted-foreground">Saved.</span>
            ) : null}
          </p>
        </div>

        {canEdit ? (
          <SheetFooter className="flex-row justify-between">
            <MediaAssetDeleteDialog
              assetTitle={asset.title}
              mediaAssetId={asset.id}
              onDeleted={onDeleted}
            />
            <Button disabled={pending} onClick={save} type="button">
              {pending ? (
                <>
                  <Loader2Icon aria-hidden className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save details"
              )}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
