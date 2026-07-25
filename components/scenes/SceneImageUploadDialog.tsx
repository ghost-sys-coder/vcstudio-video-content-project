"use client";

import { useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";
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
import { SCENE_IMAGE_SIZE_OPTIONS } from "@/lib/scenes/scene-image-size-options";
import type { SceneImageApiSize } from "@/lib/scenes/scene-image-view";
import { uploadSceneImage } from "@/lib/storage/upload-scene-image.client";

export function SceneImageUploadDialog({
  projectId,
  sceneId,
  sceneVersionId,
  sceneNumber,
  disabled,
  onUploaded,
}: {
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  sceneNumber: number;
  disabled: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<SceneImageApiSize>(
    SCENE_IMAGE_SIZE_OPTIONS[0]!.value,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <UploadIcon aria-hidden />
        Upload image
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
            <DialogTitle>Upload an image for scene {sceneNumber}</DialogTitle>
            <DialogDescription>
              Use an already-made image instead of generating one with AI. It
              will need to be approved just like a generated image.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="scene-image-upload-size">Size</Label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              disabled={pending}
              id="scene-image-upload-size"
              onChange={(event) => {
                const option = SCENE_IMAGE_SIZE_OPTIONS.find(
                  (candidate) => candidate.value === event.target.value,
                );
                if (option) setSize(option.value);
              }}
              value={size}
            >
              {SCENE_IMAGE_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.description})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scene-image-upload-file">Image file</Label>
            <Input
              accept="image/png,image/jpeg,image/webp"
              disabled={pending}
              id="scene-image-upload-file"
              ref={inputRef}
              type="file"
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, or WebP. Proportions should roughly match the selected
              size.
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
                    await uploadSceneImage({
                      projectId,
                      sceneId,
                      sceneVersionId,
                      size,
                      file,
                    });
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
              {pending ? "Uploading…" : "Upload image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
