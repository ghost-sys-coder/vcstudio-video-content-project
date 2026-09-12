"use client";

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
import { describeReframeCancellation } from "@/lib/reframe/reframe-confirmation";

/**
 * Confirms stopping a reframe that is already running.
 *
 * Worth a dialog of its own because stopping is not undoing: the images already
 * generated have been paid for and are kept. Saying so here is what stops
 * someone cancelling in the belief that it reverses the charge.
 */
export function ReframeCancelDialog({
  onConfirm,
  onOpenChange,
  open,
  pending,
  status,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  status: "extending" | "rendering";
}) {
  const cancellation = describeReframeCancellation(status);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cancellation.title}</DialogTitle>
          <DialogDescription>{cancellation.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep going
          </DialogClose>
          <Button
            disabled={pending}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {pending ? "Stopping…" : cancellation.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
