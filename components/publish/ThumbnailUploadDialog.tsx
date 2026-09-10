"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { UploadIcon } from "lucide-react";
import { ThumbnailUploadPreview } from "@/components/publish/ThumbnailUploadPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VideoContentPlatform } from "@/lib/platforms/video-content-platforms";
import { uploadThumbnail } from "@/lib/storage/upload-thumbnail.client";
import {
  checkThumbnailUploadFit,
  describeAspectRatio,
  describeThumbnailUploadTarget,
} from "@/lib/thumbnails/thumbnail-upload-fit";

/**
 * Uses a thumbnail the creator already has instead of generating one.
 *
 * Deliberately free: no estimate, no confirmation and no ledger entry, because
 * nothing is bought. The chosen file is measured and judged in the browser and
 * shown in the platform's own frame first, so a wrong shape is caught before
 * anything is uploaded rather than after a round trip. The server repeats the
 * same check on the bytes that actually arrive, since nothing the browser
 * reports can be trusted as the final word.
 */
export function ThumbnailUploadDialog({
  projectId,
  platform,
  platformLabel,
  disabled,
  onUploaded,
}: {
  projectId: string;
  platform: VideoContentPlatform;
  platformLabel: string;
  disabled: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const target = useMemo(
    () => describeThumbnailUploadTarget(platform),
    [platform],
  );
  const fit = useMemo(
    () =>
      dimensions ? checkThumbnailUploadFit({ platform, ...dimensions }) : null,
    [dimensions, platform],
  );

  // An object URL is a document-lifetime handle on the file, so it is released
  // as soon as the preview stops using it.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setDimensions(null);
    setUnreadable(false);
    setError(null);
  }, []);

  const chooseFile = useCallback((next: File | null) => {
    setDimensions(null);
    setUnreadable(false);
    setError(null);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }, []);

  const blocked =
    !file || unreadable || dimensions === null || fit?.fits === false;

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <UploadIcon aria-hidden />
        Upload thumbnail
      </Button>
      <Dialog
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        open={open}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload a {platformLabel} thumbnail</DialogTitle>
            <DialogDescription>
              Use a cover image you already have instead of generating one. It
              costs nothing and joins the {platformLabel} gallery, where you can
              favorite, download or delete it like any other thumbnail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="thumbnail-upload-file">Image file</Label>
            <Input
              accept="image/png,image/jpeg,image/webp"
              disabled={pending}
              id="thumbnail-upload-file"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, or WebP, between {target.shapeLabel} — for example{" "}
              {target.exampleDimensions}.
            </p>
          </div>

          {previewUrl ? (
            <div className="space-y-2">
              <p className="text-xs font-medium">
                {platformLabel} preview{" "}
                <span className="font-normal text-muted-foreground">
                  (shown in the frame {platformLabel} displays)
                </span>
              </p>
              <ThumbnailUploadPreview
                aspectRatio={target.previewAspectRatio}
                onMeasured={setDimensions}
                onUnreadable={() => setUnreadable(true)}
                platformLabel={platformLabel}
                previewUrl={previewUrl}
              />
              {dimensions ? (
                <p className="font-mono text-xs text-muted-foreground">
                  {dimensions.width} × {dimensions.height} ·{" "}
                  {describeAspectRatio(dimensions.width, dimensions.height)}
                </p>
              ) : null}
            </div>
          ) : null}

          {unreadable ? (
            <p className="text-xs text-destructive" role="alert">
              That file could not be read as an image. Choose a PNG, JPEG, or
              WebP file.
            </p>
          ) : null}

          {fit && !fit.fits ? (
            <p className="text-xs text-destructive" role="alert">
              {fit.message}
            </p>
          ) : null}

          {fit?.fits ? (
            <p className="text-xs text-muted-foreground" role="status">
              This image fits {platformLabel}&rsquo;s thumbnail shape.
            </p>
          ) : null}

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={pending || blocked}
              onClick={() => {
                if (!file) {
                  setError("Choose an image file first.");
                  return;
                }
                startTransition(async () => {
                  try {
                    await uploadThumbnail({ projectId, platform, file });
                    setOpen(false);
                    reset();
                    await onUploaded();
                  } catch (uploadError) {
                    setError(
                      uploadError instanceof Error
                        ? uploadError.message
                        : "Upload failed.",
                    );
                  }
                });
              }}
              type="button"
            >
              {pending ? "Uploading…" : "Upload thumbnail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
