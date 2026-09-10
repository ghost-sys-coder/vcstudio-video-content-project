"use client";

import { useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";
import type { ContentPlatform } from "@/db/schema";
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
import { uploadThumbnail } from "@/lib/storage/upload-thumbnail.client";

/**
 * Uses a thumbnail the creator already has instead of generating one.
 *
 * Deliberately free: no estimate, no confirmation and no ledger entry, because
 * nothing is bought. The platform is fixed by the gallery the creator is
 * looking at, so the image is checked against that platform's own shape.
 */
export function ThumbnailUploadDialog({
  projectId,
  platform,
  platformLabel,
  sizeLabel,
  disabled,
  onUploaded,
}: {
  projectId: string;
  platform: ContentPlatform;
  platformLabel: string;
  sizeLabel: string;
  disabled: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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
          if (!next) {
            setError(null);
            if (inputRef.current) inputRef.current.value = "";
          }
        }}
        open={open}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload a {platformLabel} thumbnail</DialogTitle>
            <DialogDescription>
              Use a cover image you already have instead of generating one. It
              costs nothing and appears in the {platformLabel} gallery alongside
              generated thumbnails, where you can favorite or select it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="thumbnail-upload-file">Image file</Label>
            <Input
              accept="image/png,image/jpeg,image/webp"
              disabled={pending}
              id="thumbnail-upload-file"
              ref={inputRef}
              type="file"
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, or WebP. Proportions should roughly match{" "}
              {platformLabel}&rsquo;s {sizeLabel} thumbnail shape, so the image
              is not stretched or cropped later.
            </p>
          </div>

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
              disabled={pending}
              onClick={() => {
                const file = inputRef.current?.files?.[0];
                if (!file) {
                  setError("Choose an image file first.");
                  return;
                }
                startTransition(async () => {
                  try {
                    await uploadThumbnail({ projectId, platform, file });
                    setError(null);
                    setOpen(false);
                    if (inputRef.current) inputRef.current.value = "";
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
