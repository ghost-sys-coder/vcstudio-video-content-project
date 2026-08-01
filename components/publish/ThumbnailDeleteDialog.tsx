"use client";

import { Trash2Icon } from "lucide-react";
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

/**
 * Confirms deleting a generated thumbnail.
 *
 * Behind a dialog rather than a bare button because this is irreversible and
 * destroys an image the workspace paid to generate — the same treatment media
 * library removal gets. The copy says plainly that the spend is not refunded,
 * since the usage ledger deliberately keeps the charge.
 */
export function ThumbnailDeleteDialog({
  busy,
  onDelete,
  thumbnailId,
  thumbnailLabel,
}: {
  busy: boolean;
  onDelete: (thumbnailId: string) => void;
  thumbnailId: string;
  thumbnailLabel: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button size="sm" variant="ghost" />}
        aria-label={`Delete ${thumbnailLabel}`}
        disabled={busy}
      >
        <Trash2Icon aria-hidden className="size-3.5" />
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this thumbnail?</DialogTitle>
          <DialogDescription>
            The image is removed from storage and cannot be recovered. What it
            cost to generate stays on the usage ledger — deleting the picture
            does not refund the spend or free up budget.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" />}
            disabled={busy}
            onClick={() => onDelete(thumbnailId)}
          >
            Delete
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
