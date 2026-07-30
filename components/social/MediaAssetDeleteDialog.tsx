"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { deleteMediaAssetAction } from "@/app/(authenticated)/app/social/actions";
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

export function MediaAssetDeleteDialog({
  assetTitle,
  mediaAssetId,
  onDeleted,
}: {
  assetTitle: string;
  mediaAssetId: string;
  onDeleted: (mediaAssetId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("mediaAssetId", mediaAssetId);
      const result = await deleteMediaAssetAction(data);
      if (result.ok) onDeleted(mediaAssetId);
      else setError(result.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Trash2Icon />
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove “{assetTitle}” from the library?</DialogTitle>
          <DialogDescription>
            It stops appearing in the library and can no longer be attached to a
            new post. Posts that already went out keep showing it, so nothing
            already published changes.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p aria-live="polite" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            onClick={remove}
            type="button"
            variant="destructive"
          >
            {pending ? (
              <>
                <Loader2Icon aria-hidden className="animate-spin" />
                Removing…
              </>
            ) : (
              "Remove"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
